import { Either, left, right } from "./either"
import { Unit, Func, identity } from "./func"
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

// `Continuation` is the symbolic representation of the rest of the monadic `Coroutine`
// program. A `Continuation` is modeled as a `Pair` of `S` and  `Coroutine`, where `S` is
// the current state in the computation and the `Coroutine` representing the remaining
// part of the computational program.
interface Continuation<S, E, A> extends Pair<S, Coroutine<S, E, A>> { }

// map_Coroutine performs a transformation of `Coroutine<S, E, A>` to `Coroutine<S, E, B>`.
let map_Coroutine = <S, E, A, B>(f: Func<A, B>): Func<Coroutine<S, E, A>, Coroutine<S, E, B>> =>
    Func(c1 => Func(state => {
        // Invoke the coroutine to find out its current state (continued, failed or succeeded).
        let processState: Either<NoRes<S, E, A>, Pair<A, S>> = c1.invoke(state)

        // Then check if the coroutine has a continuation, has failed or if it has a result.
        if (processState.kind == "left") {
            let failedOrContinuous: NoRes<S, E, A> = processState.value

            // Coroutine has a continuation or has failed. So now we have to check which one it is.
            if (failedOrContinuous.kind == "left") {
                // Coroutine has failed to process a result.
                let errorValue = failedOrContinuous.value

                return left<E, Continuation<S, E, B>>()
                    .andThen(left<NoRes<S, E, B>, Pair<B, S>>())
                    .invoke(errorValue)
            } else {
                // Coroutine has a continuation.
                let suspensionValue = failedOrContinuous.value

                return map_Pair(identity<S>(), map_Coroutine<S, E, A, B>(f))
                    .andThen(right<E, Continuation<S, E, B>>())
                    .andThen(left<NoRes<S ,E, B>, Pair<B, S>>())
                    .invoke(suspensionValue)
            }
        } else { // The coroutine has successfully computed a result!
            let computedValue = processState.value

            return map_Pair(f, identity<S>())
                .andThen(right<NoRes<S, E, B>, Pair<B, S>>())
                .invoke(computedValue)
        }
    }))

// join_Coroutine flattens a nested `Coroutine` type into a single-level `Coroutine`.
let join_Coroutine = <S, E, A>(): Func<Coroutine<S, E, Coroutine<S, E, A>>, Coroutine<S, E, A>> =>
    Func(nested => Func(state => {
        // Invoke the nested `Coroutine` to find out its current state (continued, failed or succeeded).
        let processState: Either<NoRes<S, E, Coroutine<S, E, A>>, Pair<Coroutine<S, E, A>, S>> = nested.invoke(state)

        // Then check if the coroutine has a continuation, has failed or if it has a result.
        if (processState.kind == "left") {
            let failedOrContinuous: NoRes<S, E, Coroutine<S, E, A>> = processState.value

            // Coroutine has a continuation or has failed. So now we have to check which one it is.
            if(failedOrContinuous.kind == "left") {
                // Coroutine has failed to process a result.
                return left<E, Continuation<S,E,A>>()
                    .andThen(left<NoRes<S,E,A>, Pair<A,S>>())
                    .invoke(failedOrContinuous.value)
            } else {
                 // Coroutine has a continuation.
                let continuation = failedOrContinuous.value

                return map_Pair(identity<S>(), join_Coroutine<S,E,A>())
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

// bind_Coroutine binds a `Coroutine<S, E, A>` to a `Coroutine<S, E, B>`, sequencing the  computation in order.
let bind_Coroutine = <S, E, A, B>(f: Func<A, Coroutine<S, E, B>>): Func<Coroutine<S, E, A>, Coroutine<S, E, B>> =>
    map_Coroutine<S, E, A, Coroutine<S, E, B>>(f).andThen(join_Coroutine())

// unit_Coroutine eagerly lifts the input value of `A`, into a successfully completed `Coroutine`.
let unit_Coroutine = <S, E, A>(a: A): Coroutine<S, E, A> =>
    lazyUnit_Coroutine(() => a)

// lazyUnit_Coroutine lazily lifts the input value of `A`, into a successfully completed `Coroutine`.
let lazyUnit_Coroutine = <S, E, A>(f: (_: Unit) => A): Coroutine<S, E, A> =>
    Func(state => right<NoRes<S, E, A>, Pair<A, S>>().invoke(Pair<A, S>(f({}), state)))

// completed is an alias for `unit_Coroutine`. Do NOT pass in values (e.g through a function call)
// that can throw exceptions as this CAN cause undefined behaviour.
export let completed = <S, A>(a: A): Coroutine<S, Unit, A> =>
    unit_Coroutine(a)

// completedLazy is an alias for `lazyUnit_Coroutine`. Do NOT pass in functions that can throw
// exceptions as this CAN cause undefined behaviour.
export let completedLazy = <S, A>(f: (_: Unit) => A): Coroutine<S, Unit, A> =>
    lazyUnit_Coroutine(f)

// effect lifts the effect of `f` into a Coroutine. Unlike the `compute` operator, this operator
// does not operate on a state and can be used for effects such as  database calls, network / file IO, etc.
export let effect = <E, A>(f: (_: Unit) => A): Coroutine<Unit, E, A> =>
    compute<Unit, E, A>(s => f({}))

// transform lifts the specified transformation of `f`, from one instance of `S` to another instance of `S`.
export let transform = <S, E>(f: (_: S) => S): Coroutine<S, E, S> =>
    compute<S, E, S>(f)

// compute lifts the specified computation of `f` into a Coroutine.
export let compute = <S, E, A>(f: (_: S) => A): Coroutine<S, E, A> =>
    Func(state => {
        try {
            return right<NoRes<S, E, A>, Pair<A, S>>().invoke(Pair<A, S>(f(state), state))
        } catch (e) {
            return left<NoRes<S, E, A>, Pair<A, S>>().invoke(left<E, Continuation<S, E, A>>().invoke(e))
        }
    })

// RepeatUntil repeatedly executes the given `Coroutine` process until the given predicate of `p` is satisfied.
// The execution is interrupted if an error was raised from the executed `process` coroutine.
export let RepeatUntil = <S, E, A>(p: (_: S) => boolean, process: Coroutine<S, E, A>): Coroutine<S, E, S> =>
    Func(state => {
        // TODO invoke process recursively operating on the state of the last iteration
        let processState: Either<NoRes<S, E, A>, Pair<A, S>> = process.invoke(state)

        // Then check if the coroutine has a continuation, has failed or if it has a result.
        if (processState.kind == "left") {
            let failedOrContinuous: NoRes<S, E, A> = processState.value
             
            // Coroutine has a continuation or has failed. So now we have to check which one it is.
            if (failedOrContinuous.kind == "left") {
                // Coroutine has failed to process a result.
                let errorValue = failedOrContinuous.value

                throw new Error("TODO")
            } else {
                // Coroutine has a continuation.
                let continuation = failedOrContinuous.value

                throw new Error("TODO")
            }
        } else { // The coroutine has successfully computed a result!
            let computedValue = processState.value
            let newState = computedValue.snd

            throw new Error("TODO")
        }
    })

// suspend returns a suspended `Coroutine` that does nothing until it is resumed.
export let suspend = <S, E>(): Coroutine<S, E, Unit> =>
    Func(state => { // TODO clean up
        let x: Func<NoRes<S, E, Unit>, Unit> = left<NoRes<S, E, Unit>, Unit>()
        let z: Func<Continuation<S, E, Unit>, NoRes<S, E, Unit>> = right<E, Continuation<S, E, Unit>>()

        let y: Coroutine<S, E, Unit> = unit_Coroutine<S, E, Unit>({})
        let k: NoRes<S, E, Unit> = z.invoke({ fst: state, snd: y})

        return left<NoRes<S, E, Unit>, Pair<Unit, S>>().invoke(k)
    })

// fail lifts an error value of `E`, into a `Coroutine` that has failed to produce a value,
// thus returning the lifted value of `E`.
export let fail = <S, E, A>(e: E): Coroutine<S, E, A> =>
    Func(state => left<NoRes<S, E, A>, Pair<A, S>>()
        .invoke(left<E, Continuation<S, E, A>>()
        .invoke(e)))