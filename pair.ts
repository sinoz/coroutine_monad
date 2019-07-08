import { Func } from "./func"

export type Pair<a, b> = {
    fst: a
    snd: b
  }
  
  export let Pair = <a, b>(x: a, y: b) : Pair<a, b> => {
    return {
      fst: x,
      snd: y
    }
  }
  
  export let map_Pair = <a, a1, b, b1>(f: Func<a, a1>, g: Func<b, b1>): Func<Pair<a, b>, Pair<a1, b1>> => {
    return Func((p: Pair<a, b>) => Pair<a1, b1>(f.f(p.fst), g.f(p.snd)))
  }
  