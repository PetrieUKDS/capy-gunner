"""Rewrite a fragmented MP4 (what the browser's MediaRecorder makes) as a plain MP4 with the
index at the front, so phones, editors and Instagram see the right length and can seek.
Usage: python remux.py in.mp4 out.mp4"""
import struct, sys

def boxes(b, o, e):
    while o + 8 <= e:
        size, typ = struct.unpack('>I4s', b[o:o + 8]); hdr = 8
        if size == 1: size = struct.unpack('>Q', b[o + 8:o + 16])[0]; hdr = 16
        elif size == 0: size = e - o
        yield typ.decode('latin1'), o, o + hdr, o + size
        o += size

def find(b, s, e, typ):
    for t, o, cs, ce in boxes(b, s, e):
        if t == typ: return o, cs, ce
    return None

def box(typ, payload): return struct.pack('>I4s', 8 + len(payload), typ.encode('latin1')) + payload
def full(typ, ver, flags, payload): return box(typ, struct.pack('>I', (ver << 24) | flags) + payload)

src = open(sys.argv[1], 'rb').read()
top = list(boxes(src, 0, len(src)))
ftyp = next(src[o:ce] for t, o, cs, ce in top if t == 'ftyp')
mo, mcs, mce = next((o, cs, ce) for t, o, cs, ce in top if t == 'moov')

# track info from moov: id -> trak bounds, timescale, defaults from trex
traks = {}
for t, o, cs, ce in boxes(src, mcs, mce):
    if t == 'trak':
        _, tcs, tce = find(src, cs, ce, 'tkhd'); ver = src[tcs]
        tid = struct.unpack('>I', src[tcs + (20 if ver == 1 else 12):][:4])[0]
        _, mdcs, mdce = find(src, cs, ce, 'mdia'); _, hcs, hce = find(src, mdcs, mdce, 'mdhd'); hv = src[hcs]
        ts = struct.unpack('>I', src[hcs + (20 if hv == 1 else 12):][:4])[0]
        _, hdcs, _ = find(src, mdcs, mdce, 'hdlr'); handler = src[hdcs + 8:hdcs + 12].decode('latin1')
        traks[tid] = {'o': o, 'ce': ce, 'ts': ts, 'handler': handler, 'samples': [], 'chunks': [], 'dur': 1024, 'size': 0, 'flags': 0}
mvex = find(src, mcs, mce, 'mvex')
if mvex:
    for t, o, cs, ce in boxes(src, mvex[1], mvex[2]):
        if t == 'trex':
            tid, _, dd, ds, df = struct.unpack('>IIIII', src[cs + 4:cs + 24])
            if tid in traks: traks[tid].update(dur=dd, size=ds, flags=df)

# walk the fragments, collecting every sample's position, size, duration, flags and composition offset
for t, o, cs, ce in top:
    if t != 'moof': continue
    for t2, o2, cs2, ce2 in boxes(src, cs, ce):
        if t2 != 'traf': continue
        _, hcs, hce = find(src, cs2, ce2, 'tfhd')
        fl = struct.unpack('>I', src[hcs:hcs + 4])[0] & 0xffffff; tid = struct.unpack('>I', src[hcs + 4:hcs + 8])[0]; p = hcs + 8
        T = traks[tid]; base = o; dd, ds, df = T['dur'], T['size'], T['flags']
        if fl & 0x1: base = struct.unpack('>Q', src[p:p + 8])[0]; p += 8
        if fl & 0x2: p += 4
        if fl & 0x8: dd = struct.unpack('>I', src[p:p + 4])[0]; p += 4
        if fl & 0x10: ds = struct.unpack('>I', src[p:p + 4])[0]; p += 4
        if fl & 0x20: df = struct.unpack('>I', src[p:p + 4])[0]; p += 4
        tf = find(src, cs2, ce2, 'tfdt')
        if tf:
            v = src[tf[1]]; bmdt = struct.unpack('>Q' if v == 1 else '>I', src[tf[1] + 4:tf[1] + (12 if v == 1 else 8)])[0]
            have = sum(s[2] for s in T['samples'])
            if T['samples'] and bmdt > have: T['samples'][-1][2] += bmdt - have  # close any gap (e.g. a pause)
            T.setdefault('start', bmdt) if not T['samples'] else None
        for t3, o3, cs3, ce3 in boxes(src, cs2, ce2):
            if t3 != 'trun': continue
            vf = struct.unpack('>I', src[cs3:cs3 + 4])[0]; ver, f = vf >> 24, vf & 0xffffff
            n = struct.unpack('>I', src[cs3 + 4:cs3 + 8])[0]; q = cs3 + 8
            off = base
            if f & 0x1: off = base + struct.unpack('>i', src[q:q + 4])[0]; q += 4
            first = None
            if f & 0x4: first = struct.unpack('>I', src[q:q + 4])[0]; q += 4
            T['chunks'].append((len(T['samples']), n))
            for i in range(n):
                d, sz, sf, cto = dd, ds, df, 0
                if f & 0x100: d = struct.unpack('>I', src[q:q + 4])[0]; q += 4
                if f & 0x200: sz = struct.unpack('>I', src[q:q + 4])[0]; q += 4
                if f & 0x400: sf = struct.unpack('>I', src[q:q + 4])[0]; q += 4
                elif i == 0 and first is not None: sf = first
                if f & 0x800: cto = struct.unpack('>i' if ver else '>I', src[q:q + 4])[0]; q += 4
                T['samples'].append([off, sz, d, sf, cto]); off += sz

def run_length(vals):
    out = []
    for v in vals:
        if out and out[-1][1] == v: out[-1][0] += 1
        else: out.append([1, v])
    return out

def build(chunk_offsets):
    """moov with the given chunk offsets per track"""
    mv = find(src, mcs, mce, 'mvhd'); mvts = struct.unpack('>I', src[mv[1] + (20 if src[mv[1]] == 1 else 12):][:4])[0]
    moov_dur = 0; trak_boxes = []
    for tid, T in traks.items():
        S = T['samples']; tdur = sum(s[2] for s in S); moov_dur = max(moov_dur, tdur * mvts // T['ts'])
        stbl = []
        old = find(src, *find(src, *find(src, *find(src, T['o'] + 8, T['ce'], 'mdia')[1:], 'minf')[1:], 'stbl')[1:], 'stsd')
        stbl.append(src[old[0]:old[2]])
        stbl.append(full('stts', 0, 0, struct.pack('>I', 0) + b''))
        rl = run_length([s[2] for s in S]); stbl[-1] = full('stts', 0, 0, struct.pack('>I', len(rl)) + b''.join(struct.pack('>II', c, v) for c, v in rl))
        if any(s[4] for s in S):
            rl = run_length([s[4] for s in S]); stbl.append(full('ctts', 1, 0, struct.pack('>I', len(rl)) + b''.join(struct.pack('>Ii', c, v) for c, v in rl)))
        if T['handler'] == 'vide':
            sync = [i + 1 for i, s in enumerate(S) if not (s[3] & 0x10000)]
            stbl.append(full('stss', 0, 0, struct.pack('>I', len(sync)) + b''.join(struct.pack('>I', i) for i in sync)))
        sc = []
        for ci, (first, n) in enumerate(T['chunks']):
            if not sc or sc[-1][1] != n: sc.append((ci + 1, n))
        stbl.append(full('stsc', 0, 0, struct.pack('>I', len(sc)) + b''.join(struct.pack('>III', a, n, 1) for a, n in sc)))
        stbl.append(full('stsz', 0, 0, struct.pack('>II', 0, len(S)) + b''.join(struct.pack('>I', s[1]) for s in S)))
        stbl.append(full('co64', 0, 0, struct.pack('>I', len(chunk_offsets[tid])) + b''.join(struct.pack('>Q', c) for c in chunk_offsets[tid])))
        stbl_box = box('stbl', b''.join(stbl))
        # rebuild trak: copy everything, swapping in new durations and the new stbl, dropping edit lists
        def rewrite(o, cs, ce, typ):
            if typ == 'stbl': return stbl_box
            if typ == 'edts': return b''
            if typ in ('tkhd', 'mdhd'):
                b = bytearray(src[o:ce]); v = b[cs - o]
                if typ == 'tkhd': pos = (cs - o) + (28 if v == 1 else 20); d = tdur * mvts // T['ts']
                else: pos = (cs - o) + (24 if v == 1 else 16); d = tdur
                b[pos:pos + (8 if v == 1 else 4)] = struct.pack('>Q' if v == 1 else '>I', d); return bytes(b)
            if typ in ('mdia', 'minf'):
                return box(typ, b''.join(rewrite(o2, c2, e2, t2) for t2, o2, c2, e2 in boxes(src, cs, ce)))
            return src[o:ce]
        trak_boxes.append(box('trak', b''.join(rewrite(o2, c2, e2, t2) for t2, o2, c2, e2 in boxes(src, T['o'] + 8, T['ce']))))
    parts = []
    for t, o, cs, ce in boxes(src, mcs, mce):
        if t == 'mvhd':
            b = bytearray(src[o:ce]); v = b[cs - o]; pos = (cs - o) + (24 if v == 1 else 16)
            b[pos:pos + (8 if v == 1 else 4)] = struct.pack('>Q' if v == 1 else '>I', moov_dur); parts.append(bytes(b))
        elif t == 'trak': parts.append(trak_boxes.pop(0))
        elif t == 'mvex': continue
        else: parts.append(src[o:ce])
    return box('moov', b''.join(parts))

# mdat: each fragment's samples, track by track, in file order
payload = bytearray(); rel = {tid: [] for tid in traks}
for tid, T in traks.items():
    for first, n in T['chunks']:
        rel[tid].append(len(payload))
        for s in T['samples'][first:first + n]: payload += src[s[0]:s[0] + s[1]]
moov = build({tid: [0] * len(v) for tid, v in rel.items()})
head = len(ftyp) + len(moov) + 16  # 64-bit mdat header
moov = build({tid: [head + r for r in v] for tid, v in rel.items()})
assert len(ftyp) + len(moov) + 16 == head
with open(sys.argv[2], 'wb') as f:
    f.write(ftyp); f.write(moov); f.write(struct.pack('>I4sQ', 1, b'mdat', 16 + len(payload))); f.write(payload)
for tid, T in traks.items():
    print(T['handler'], len(T['samples']), 'samples', round(sum(s[2] for s in T['samples']) / T['ts'], 2), 's')
