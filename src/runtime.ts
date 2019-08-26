import { Coroutine } from "./coroutine"
import { Pair, map_Pair } from "./pair"
import { Either, left, right } from "./either"

// Unsafely invokes the given `Coroutine` with the given state of `S`. May throw an exception.
export let unsafeRun = <S, E, A>(coroutine: Coroutine<S, E, A>, s: S): Either<Coroutine<S, E, A>, Pair<A, S>> => {
    let result = coroutine.invoke(s)
    if (result.kind == "right") {
        return right<Coroutine<S, E, A>, Pair<A, S>>().invoke(result.value)
    } else {
        if (result.value.kind == "left") {
            throw new Error("Coroutine failed with: " + result.value.value)
        } else {
            return left<Coroutine<S, E, A>, Pair<A, S>>().invoke(result.value.value.snd)
        }
    }
}

// Unsafely invokes the given `Coroutine` with the given state of `S`. Unlike the regular `unsafeRun`, this
// operation will try its best to obtain the produced value from `Coroutine`. Will throw an exception otherwise.
export let unsafeRunGetValue = <S, E, A>(coroutine: Coroutine<S, E, A>, s: S): Pair<A, S> => {
    let result = unsafeRun(coroutine, s)
    if (result.kind == "left") {
        throw new Error("")
    } else {
        return result.value
    }
}