"""One-time authoring script; never used by the production build."""
import json, math, pathlib, subprocess, tempfile, wave
ROOT = pathlib.Path(__file__).resolve().parents[1]
TMP = pathlib.Path(tempfile.mkdtemp())
def run(*args):
    subprocess.run([str(a) for a in args], check=True, stdout=subprocess.DEVNULL, cwd=TMP)
def sprite(name, frame=None):
    pixels=[]
    for y in range(32):
        for x in range(32):
            color=None
            if name=='body':
                d=abs(y-15.5)
                if d<10: color='#075b65' if d>8 else '#1bbda8' if d>5 else '#52e4bd'
                if 8<=y<=9: color='#a4ffcd'
                if 12<=y<=19 and (x+y)%12<2: color='#119b99'
            elif name=='corner':
                d=math.hypot(x-31.5,y-31.5)
                if 6<d<26: color='#075b65' if d<8 or d>24 else '#1bbda8' if d<11 or d>21 else '#52e4bd'
                if 22<d<24: color='#a4ffcd'
            elif name=='tail':
                half=min(10,(x+2)*.36)
                d=abs(y-15.5)
                if d<half: color='#075b65' if d>half-2 else '#23c7ab'
                if d<half-3 and y<15: color='#77f2c3'
            else:
                d=abs(y-15.5)
                half=10 if x<8 else 13 if x<23 else 11 if x<28 else 8
                if d<half: color='#0a6b62' if d>half-2 else '#a4f66c' if y>17 else '#d9ff8b'
                if 4<x<13 and 8<y<23: color='#70d99a'
                if 17<=x<=23 and (7<=y<=11 or 20<=y<=24): color='#0a252c'
                if 20<=x<=22 and (8<=y<=9 or 21<=y<=22): color='#faffea'
                opening=[1,4,8,4][frame]
                if x>=24-(opening//2) and abs(y-15.5)<opening: color=None
                if x in (24,25) and opening>1 and abs(y-15.5)>=opening-2 and abs(y-15.5)<opening: color='#fffde1'
            if color: pixels.append({'op':'fill_rect','x':x,'y':y,'width':1,'height':1,'color':color})
    actions=TMP/f'{name}{frame}.json'; actions.write_text(json.dumps(pixels))
    dest=ROOT/'assets/snake'/ (f'head/{frame}.png' if frame is not None else f'{name}.png')
    run('draw-sheet' if frame is not None else 'draw','render','--actions',actions,'--out',dest,'--width',32,'--height',32,'--no-layers')
for n in ['body','corner','tail']: sprite(n)
for f in range(4): sprite('head',f)
def config(name, duration):
    p=TMP/f'{name}.json'
    p.write_text(json.dumps(dict(sample_rate=44100,channels='stereo',max_duration_ms=duration,seed=17,actions=str(TMP/f'{name}-actions.json'),preview=str(TMP/f'{name}.png'),wav=str(ROOT/f'assets/audio/{name}.wav'),mid=str(ROOT/f'assets/audio/{name}.mid'))))
    return p
for name,freq,duration in [('eat',660,65),('combo-up',1100,170),('death',130,650)]:
    c=config(name,duration+100)
    run('sfx-synth','--config',c,'init')
    run('sfx-synth','--config',c,'add-voice','--name','tone','--wave','triangle' if name!='death' else 'saw','--freq',freq,'--dur',duration,'--gain=-13')
    run('sfx-synth','--config',c,'set-envelope','--voice','tone','--env','pluck')
    run('sfx-synth','--config',c,'set-pitch','--voice','tone','--slide-to',freq*(1.6 if name!='death' else .22),'--over',duration)
    if name=='death':
        run('sfx-synth','--config',c,'add-voice','--name','impact','--wave','noise','--dur',150,'--gain=-20')
        run('sfx-synth','--config',c,'set-envelope','--voice','impact','--env','pluck')
    run('sfx-synth','--config',c,'render')
c=config('music',16000)
run('music','--config',c,'init')
run('music','--config',c,'set-tempo','--bpm',120)
for name,instrument,gain in [('bass','triangle',-25),('arp','sine',-29),('pulse','sine',-28)]:
    run('music','--config',c,'define-track','--name',name,'--instrument',instrument)
    run('music','--config',c,'set-track-fx','--track',name,f'--gain={gain}','--env','pluck')
for beat in range(32):
    root=[45,41,48,43][beat//8]
    run('music','--config',c,'add-note','--track','bass','--pitch',root,'--t',beat,'--dur',.65,'--velocity',85)
    run('music','--config',c,'add-note','--track','pulse','--pitch',28,'--t',beat,'--dur',.18,'--velocity',70)
    for j in range(2):
        run('music','--config',c,'add-note','--track','arp','--pitch',root+24+[0,7,12,7][(beat*2+j)%4],'--t',beat+j*.5,'--dur',.32,'--velocity',65)
run('music','--config',c,'render')
# Keep the musical period exact, with quiet note tails before the seam.
p=ROOT/'assets/audio/music.wav'
with wave.open(str(p),'rb') as w: params=w.getparams(); data=w.readframes(w.getnframes())
length=44100*16*params.nchannels*params.sampwidth
data=(data+b'\0'*max(0,length-len(data)))[:length]
with wave.open(str(p),'wb') as w: w.setparams(params); w.writeframes(data)
