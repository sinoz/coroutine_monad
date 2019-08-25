import { Func } from "./func"

export type Either<a, b> = {
    kind: "left",
    value: a
  } | {
    kind: "right",
    value: b
  }
  
  export let left = <a, b>(): Func<a, Either<a, b>> => {
    return Func<a, Either<a, b>>((x: a) => {
      return {
      kind: "left",
      value: x
    }})
  }
  
  export let right = <a, b>(): Func<b, Either<a, b>> => {
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
          let newValue = f.invoke(e.value)
          return left<a1, b1>().invoke(newValue)
        }
        else {
          let newValue = g.invoke(e.value)
          return right<a1, b1>().invoke(newValue)
        }
      }) // e.kind == "Left" ? f.then(inl()) : g.then(inr()) 
  }
  
  export let unit_Either = <a, b>() : Func<a,Either<b,a>> => right<b,a>()
  
  export let join_Either = <a, b>() : Func<Either<b,Either<b,a>>, Either<b,a>> =>
    Func(x => x.kind == "left" ? left<b,a>().invoke(x.value)
                  : x.value)