import { Either, inl, inr } from "./either"
import { Unit, Func, id } from "./func"
import { Pair, map_Pair } from "./pair"

type Coroutine<s, e, a> = Func<s, Either<NoRes<s, e, a>, Pair<a, s>>>
type NoRes<s, e, a> = Either<e, Continuation<s, e, a>>
interface Continuation<s, e, a> extends Pair<s, Coroutine<s, e, a>> { }

let unit_Coroutine = <s,e,a>(): Func<a, Coroutine<s,e,a>> =>
    Func(x => Func(s => inr<NoRes<s,e,a>, Pair<a,s>>().f(Pair(x,s))))

let map_Coroutine = <s,e,a,b>(f: Func<a,b>): Func<Coroutine<s,e,a>, Coroutine<s,e,b>> =>
    Func(p => Func(s => {
        let res: Either<NoRes<s, e, a>, Pair<a, s>> = p.f(s)
        if (res.kind == "left") {
            if (res.value.kind == "left") {
                let step1 = inl<e, Continuation<s,e,b>>().f(res.value.value)
                let step2 = inl<NoRes<s,e,b>, Pair<b,s>>().f(step1)
                return step2
                // let expected = inl<e, Continuation<s,e,b>>().then(inl<NoRes<s,e,b>, Pair<b,s>>()).f(res.value.value)
                // return expected
            } else {
                let step1 = map_Pair(id<s>(), map_Coroutine<s,e,a,b>(f)).f(res.value.value)
                let step2 = inr<e, Continuation<s, e, b>>().f(step1)
                let step3 = inl<NoRes<s,e,b>, Pair<b,s>>().f(step2)

                return step3
            }
        } else {
            let step1 = map_Pair(f, id<s>()).f(res.value)
            let step2 = inr<NoRes<s,e,b>, Pair<b,s>>().f(step1)

            return step2
        }
    }))

let join_Coroutine = <s,e,a>(): Func<Coroutine<s,e, Coroutine<s,e,a>>, Coroutine<s,e,a>> =>
    Func(p => Func(s => {
        let res = p.f(s)
        if (res.kind == "left") {
            if(res.value.kind == "left") {
                return inl<e, Continuation<s,e,a>>().then(inl<NoRes<s,e,a>, Pair<a,s>>()).f(res.value.value)
            } else {
                let rest = res.value.value
                let step1 = map_Pair(id<s>(), join_Coroutine<s,e,a>()).f(rest)
                let step2 = inr<e, Continuation<s,e,a>>().f(step1)
                let step3 = inl<NoRes<s,e,a>, Pair<a,s>>().f(step2)
                return step3
            }
        } else {
            let rest = res.value
            let step1 = rest.fst.f(rest.snd)
            return step1
        }
    }))

let bind_Coroutine = <s,e,a,b>(f: Func<a, Coroutine<s,e,b>>): Func<Coroutine<s,e,a>, Coroutine<s,e,b>> =>
    Func(coroutine => map_Coroutine<s, e, a, Coroutine<s, e, b>>(f).then(join_Coroutine()).f(coroutine))