import { Either, left, right } from "./either"
import { Unit, Func, identity } from "./func"
import { Pair, map_Pair } from "./pair"
import { Option } from "./option"

// A `Coroutine` represents an effectful computation that can be suspended at
// runtime without consuming resources (unlike an operating system thread, when
// blocked it continues to make use of memory). When a `Coroutine` is suspended,
// it allows other `Coroutine`s to take up CPU-time to perform (a little bit of)
// work thus yielding cooperatively. A `Coroutine` may consist of multiple steps
// of a computation. When one coroutine has finished a step, it can then suspend
// itself and have the scheduler resume the computation later when needed.
// This is especially important in application use cases such as games, where many
// stateful computations are running at the same time and need control over how
// and when a computation may be performed, in order to retain a healthy frame rate
// at which things are processed. Threads cannot be used for this, as they are far
// too heavyweight to be frequently constructed and destroyed. By introducing the
// concept of coroutines, which are stackless and incredibly lightweight, computations
// can be modeled as small steps in a simulation that a scheduler (which runs at the
// edge of our world) can schedule to run on real operating system threads.
//
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
    Func(state => right<NoRes<S, E, A>, Pair<A, S>>().invoke(Pair<A, S>(a, state)))

// completed is an alias for `unit_Coroutine`. Do NOT pass in values (e.g through a function call)
// that can throw exceptions as this CAN cause undefined behaviour.
export let completed = <S, A>(a: A): Coroutine<S, Unit, A> =>
    unit_Coroutine(a)

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
export let failWith = <S, E, A>(e: E): Coroutine<S, E, A> =>
    Func(state => left<NoRes<S, E, A>, Pair<A, S>>()
        .invoke(left<E, Continuation<S, E, A>>()
        .invoke(e)))

// effect lifts the effect of `f` into a Coroutine. Unlike the `compute` operator, this operator
// does not operate on a state and can be used for effects such as  database calls, network / file IO, etc.
// Exceptions thrown in the given computation are safely captured.
export let effect = <E, A>(f: (_: Unit) => A): Coroutine<Unit, E, A> =>
    compute<Unit, E, A>(s => f({}))

// transform lifts the specified transformation of `f`, from one instance of `S` to another instance of `S`.
// Exceptions thrown in the given computation are safely captured.
export let transform = <S, E>(f: (_: S) => S): Coroutine<S, E, S> =>
    Func(state => {
        try {
            let newState = f(state)
            return right<NoRes<S, E, S>, Pair<S, S>>().invoke(Pair<S, S>(newState, newState))
        } catch (e) {
            return left<NoRes<S, E, S>, Pair<S, S>>().invoke(left<E, Continuation<S, E, S>>().invoke(e))
        }
    })

// compute lifts the specified computation of `f` into a Coroutine. Unlike the `transform` variant, this
// operator only uses the State for reading purposes. New state cannot evolve during this computation.
// Exceptions thrown in the given computation are safely captured.
export let compute = <S, E, A>(f: (_: S) => A): Coroutine<S, E, A> =>
    Func(state => {
        try {
            return right<NoRes<S, E, A>, Pair<A, S>>().invoke(Pair<A, S>(f(state), state))
        } catch (e) {
            return left<NoRes<S, E, A>, Pair<A, S>>().invoke(left<E, Continuation<S, E, A>>().invoke(e))
        }
    })

// fromOption lifts the given `Option` type into a `Coroutine`.
export let fromOption = <S, A>(opt: Option<A>): Coroutine<S, Unit, A> =>
    opt.kind == "none" ? failWith({}) : unit_Coroutine(opt.value)

// fromEither lifts the given `Either` type into a `Coroutine`.
export let fromEither = <S, E, A>(either: Either<E, A>): Coroutine<S, E, A> =>
    either.kind == "left" ? failWith(either.value) : unit_Coroutine(either.value)

// Wait constructs a delay of the specified amount of ticks.
export let Wait = <S>(ticks: number): Coroutine<S, Unit, Unit> =>
    ticks <= 0 ? unit_Coroutine({}) : bind_Coroutine<S, Unit, Unit, Unit>(Func(() => Wait(ticks - 1))).invoke(suspend())

// Delay is an alias for 'Wait'.
export let Delay = <S>(ticks: number): Coroutine<S, Unit, Unit> =>
    Wait(ticks)

// `Race` lets two given `Coroutine`s race it out, returning the result of the first `Coroutine` that completes its course.
// The execution is interrupted if an error was raised from either executed coroutines.
export let Race = <S, E, A, A1>(fst: Coroutine<S, E, A>, snd: Coroutine<S, E, A1>): Coroutine<S, E, Either<A, A1>> =>
    Func(state => {
        let fstRes = fst.invoke(state)
        let sndRes = snd.invoke(state)

        if (fstRes.kind == "right" && sndRes.kind == "left") { // first one is done
            return unit_Coroutine<S, E, Either<A, A1>>(left<A, A1>().invoke(fstRes.value.fst)).invoke(state)
        } else if (fstRes.kind == "left" && sndRes.kind == "right") { // second one is done
            return unit_Coroutine<S, E, Either<A, A1>>(right<A, A1>().invoke(sndRes.value.fst)).invoke(state)
        } else if (fstRes.kind == "right" && sndRes.kind == "right") { // both are done
            // emulating the behaviour of JavaScript's Promise.race(), return the first passed
            // in Coroutine if both coroutines have completed their course.
            return unit_Coroutine<S, E, Either<A, A1>>(left<A, A1>().invoke(fstRes.value.fst)).invoke(state)
        } else if (fstRes.kind == "left" && sndRes.kind == "left") { // neither are done
            if (fstRes.value.kind == "left") { // first Coroutine has failed.
                return failWith<S, E, Either<A, A1>>(fstRes.value.value).invoke(state)
            } else if (sndRes.value.kind == "left") { // second Coroutine has failed.
                return failWith<S, E, Either<A, A1>>(sndRes.value.value).invoke(state)
            } else if (fstRes.value.kind == "right" && sndRes.value.kind == "right") { // both Coroutines are suspended
                return Race<S, E, A, A1>(fstRes.value.value.snd, sndRes.value.value.snd).invoke(state)
            } else if (fstRes.value.kind == "right") { // only the first Coroutine is suspended
                return Race<S, E, A, A1>(fstRes.value.value.snd, snd).invoke(state)
            } else if (sndRes.value.kind == "right") { // only the second Coroutine is suspended
                return Race<S, E, A, A1>(fst, sndRes.value.value.snd).invoke(state)
            }
        }
    })

// Concurrent is an alias for `Race`.
export let Concurrent = <S, E, A, A1>(fst: Coroutine<S, E, A>, snd: Coroutine<S, E, A1>): Coroutine<S, E, Either<A, A1>> =>
    Race(fst, snd)

// RepeatUntil repeatedly executes the given `Coroutine` process until the given predicate of `p` is satisfied.
// The execution is interrupted if an error was raised from the executed `process` coroutine.
export let RepeatUntil = <S, E>(p: (_: S) => boolean, process: Coroutine<S, E, S>): Coroutine<S, E, S> =>
    Func(state => {
        if (p(state)) {
            return unit_Coroutine<S, E, S>(state).invoke(state)
        } else {
            let processState: Either<NoRes<S, E, S>, Pair<S, S>> = process.invoke(state)

            // Then check if the coroutine has a continuation, has failed or if it has a result.
            if (processState.kind == "left") {
                let failedOrContinuous: NoRes<S, E, S> = processState.value
                
                // Coroutine has a continuation or has failed. So now we have to check which one it is.
                if (failedOrContinuous.kind == "left") {
                    // Coroutine has failed to process a result.
                    let errorValue = failedOrContinuous.value

                    return failWith<S, E, S>(errorValue).invoke(state)
                } else {
                    // Coroutine has a continuation.
                    let continuation = failedOrContinuous.value

                    return continuation.snd.invoke(state) // TODO is this correct???
                }
            } else { // The coroutine has successfully computed a result!
                let happyPath = processState.value
                let newState = happyPath.snd

                return RepeatUntil<S, E>(p, process).invoke(newState)
            }
        }
    })