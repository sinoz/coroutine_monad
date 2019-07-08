import { Func } from "./func"

export type Either<a, b> = {
    kind: "left",
    value: a
  } | {
    kind: "right",
    value: b
  }
  
  export let inl = <a, b>(): Func<a, Either<a, b>> => {
    return Func<a, Either<a, b>>((x: a) => {
      return {
      kind: "left",
      value: x
    }})
  }
  
  export let inr = <a, b>(): Func<b, Either<a, b>> => {
    return Func<b, Either<a, b>>((x: b) => {
      return {
      kind: "right",
      value: x
    }})
  }
  
  export let map_Either = <a, a1, b, b1>(f: Func<a, a1>, g: Func<b, b1>): 
    Func<Either<a, b>, Either<a1, b1>> => {
      return Func((e: Either<a, b>): Either<a1, b1> => {
        if (e.kind == "left") {
          let newValue = f.f(e.value)
          return inl<a1, b1>().f(newValue)
        }
        else {
          let newValue = g.f(e.value)
          return inr<a1, b1>().f(newValue)
        }
      }) // e.kind == "Left" ? f.then(inl()) : g.then(inr()) 
  }
  
  export let unit_Either = <a, b>() : Func<a,Either<b,a>> => inr<b,a>()
  
  export let join_Either = <a, b>() : Func<Either<b,Either<b,a>>, Either<b,a>> =>
    Func(x => x.kind == "left" ? inl<b,a>().f(x.value)
                  : x.value)