import { Either, left, right } from "./either"
import { Unit, Func, id } from "./func"
import { Pair, map_Pair } from "./pair"

// A `Coroutine` represents an effectful operation that can be suspended at
// runtime without consuming resources, thus yielding cooperatively.
// When invoked, a Coroutine takes a State to perform the operation on, and
// either returns a `NoRes`, which is an indicator of the Coroutine continuing
// its computation or having failed, or, it returns a Pair with the result of
// `A` and the new state of `S`. When returned the Pair, it is to be assumed
// that the Coroutine has completed its course.
type Coroutine<S, E, A> = Func<S, Either<NoRes<S, E, A>, Pair<A, S>>>

// NoRes is an indicator of the `Coroutine` type either continuing its computation
// through another coroutine, or, having failed to compute a value entirely.
type NoRes<S, E, A> = Either<E, Continuation<S, E, A>>

// `Continuation` is the symbolic representation of the rest of the monadic
// `Coroutine` program.
interface Continuation<S, E, A> extends Pair<S, Coroutine<S, E, A>> { }

// completed_Coroutine returns a `Func` that lifts its input value of `A`, into a
// successfully completed `Coroutine`.
let completed_Coroutine = <S, E, A>(): Func<A, Coroutine<S, E, A>> =>
    Func(value => Func(state => right<NoRes<S, E, A>, Pair<A, S>>()
        .invoke(Pair<A, S>(value,state))))

// suspend_Coroutine returns a suspended `Coroutine` that does nothing until it is resumed.
let suspend_Coroutine = <S, E>(): Coroutine<S, E, Unit> =>
    Func(state => {
        let x: Func<NoRes<S, E, Unit>, Unit> = left<NoRes<S, E, Unit>, Unit>()
        let z: Func<Continuation<S, E, Unit>, NoRes<S, E, Unit>> = right<E, Continuation<S, E, Unit>>()

        let hehe: Coroutine<S, E, Unit> = completed_Coroutine<S, E, Unit>().invoke({})
        let result: NoRes<S, E, Unit> = z.invoke({ fst: state, snd: hehe})

        return left<NoRes<S, E, Unit>, Pair<Unit, S>>().invoke(result)
    })

// failed_Coroutine returns a `Func` that lifts an error value of `E`, into a
// failed `Coroutine`.
let failed_Coroutine = <S, E, A>(): Func<E, Coroutine<S, E, A>> =>
    Func(error => Func(state => left<NoRes<S, E, A>, Pair<A, S>>()
        .invoke(left<E, Continuation<S, E, A>>()
        .invoke(error))))

// map_Coroutine performs a transformation of `Coroutine<S, E, A>` to `Coroutine<S, E, B>`.
let map_Coroutine = <S, E, A, B>(f: Func<A, B>): Func<Coroutine<S, E, A>, Coroutine<S, E, B>> =>
    Func(c1 => Func(state => {
        // Invoke the coroutine to find out its current state (suspended, failed or succeeded).
        let processState: Either<NoRes<S, E, A>, Pair<A, S>> = c1.invoke(state)

        // Then check if the coroutine has been suspended/failed or if it has a result.
        if (processState.kind == "left") {
            let failedOrContinuous: NoRes<S, E, A> = processState.value

            // Coroutine has been suspended or has failed. So now we have to check which one it is.
            if (failedOrContinuous.kind == "left") {
                // Coroutine has failed to process a result.
                let errorValue = failedOrContinuous.value

                return left<E, Continuation<S, E, B>>()
                    .andThen(left<NoRes<S, E, B>, Pair<B, S>>())
                    .invoke(errorValue)
            } else {
                // Coroutine has a continuation.
                let suspensionValue = failedOrContinuous.value

                return map_Pair(id<S>(), map_Coroutine<S, E, A, B>(f))
                    .andThen(right<E, Continuation<S, E, B>>())
                    .andThen(left<NoRes<S ,E, B>, Pair<B, S>>())
                    .invoke(suspensionValue)
            }
        } else { // The coroutine has successfully computed a result!
            let computedValue = processState.value

            return map_Pair(f, id<S>())
                .andThen(right<NoRes<S, E, B>, Pair<B, S>>())
                .invoke(computedValue)
        }
    }))

// join_Coroutine flattens a nested `Coroutine` type into a single-level `Coroutine`.
let join_Coroutine = <S, E, A>(): Func<Coroutine<S, E, Coroutine<S, E, A>>, Coroutine<S, E, A>> =>
    Func(nested => Func(state => {
        // Invoke the nested `Coroutine`  to find out its current state (suspended, failed or succeeded).
        let processState: Either<NoRes<S, E, Coroutine<S, E, A>>, Pair<Coroutine<S, E, A>, S>> = nested.invoke(state)

        // Then check if the coroutine has a continuation, has failed or if it has a result.
        if (processState.kind == "left") {
            // Coroutine has a continuation or has failed. So now we have to check which one it is.
            if(processState.value.kind == "left") {
                // Coroutine has failed to process a result.
                return left<E, Continuation<S,E,A>>()
                    .andThen(left<NoRes<S,E,A>, Pair<A,S>>())
                    .invoke(processState.value.value)
            } else {
                 // Coroutine has a continuation.
                let continuation = processState.value.value

                return map_Pair(id<S>(), join_Coroutine<S,E,A>())
                    .andThen(right<E, Continuation<S,E,A>>())
                    .andThen(left<NoRes<S,E,A>, Pair<A,S>>())
                    .invoke(continuation)
            }
        } else { // The coroutine has successfully computed a result!
            // extracts the result of the double layered `Coroutine`, which is another
            // `Coroutine` and a state of `S`.
            let computedValue: Pair<Coroutine<S, E, A>, S> = processState.value

            // Extracts the `Coroutine` and the state of `S`.
            let next: Coroutine<S, E, A> = computedValue.fst
            let stateOfCoroutine: S = computedValue.snd

            // And invoke that coroutine with that state
            return next.invoke(stateOfCoroutine)
        }
    }))

// bind_Coroutine binds a `Coroutine<S, E, A>` to a `Coroutine<S, E, B>`, sequencing the
// computation in order.
let bind_Coroutine = <S, E, A, B>(f: Func<A, Coroutine<S, E, B>>): Func<Coroutine<S, E, A>, Coroutine<S, E, B>> =>
    map_Coroutine<S, E, A, Coroutine<S, E, B>>(f).andThen(join_Coroutine())