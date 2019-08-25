import { Either, left, right } from "./either"
import { Unit, Func, identity } from "./func"
import { Pair, map_Pair } from "./pair"
import { Option } from "./option"
import { List } from "immutable"

// A `Coroutine` represents an effectful computation that can be suspended at
// runtime without consuming resources (unlike an operating system thread, when
// blocked it continues to make use of memory). When a `Coroutine` is suspended,
// it allows other `Coroutine`s to take up CPU-time to perform (a little bit of)
// work thus yielding cooperatively. A `Coroutine` may consist of multiple steps
// of a computation. When one coroutine has finished a step, it can then suspend
// itself and have the scheduler resume the computation later when needed.
// This is especially important in application use cases such as games, where many
// stateful computations are running at the same time and need control over how
// and when a computation may be performed. This allows applications to retain a
// healthy frame rate. Threads are not suitable for this use case. They are far
// far too heavyweight to be frequently constructed and destroyed. Therefore, by
// introducing the concept of coroutines, which are stackless and lightweight,
// computations can be modeled as small steps in a simulation that a scheduler
// (which runs at the edge of our world) can schedule to run on real operating
// system threads.

// The underlying and monadic definition of a coroutine. When invoked, a Coroutine
// takes a State to perform the operation on, and either returns a `NoRes`, which
// is an indicator of the Coroutine continuing its computation or having failed,
// or, it returns a Pair with the result of `A` and the new state of `S`. When
// returned the Pair, it is to be assumed that the Coroutine has completed its
// course.
type CoroutineM<S, E, A> = Func<S, Either<NoRes<S, E, A>, Pair<A, S>>>

// The operations of the `Coroutine` that can be accessed as methods.
interface CoroutineOps<S, E, A> {
    map: <S, E, A, B>(f: (_: A) => B) => Coroutine<S, E, B>

    bind: <B>(f: (_: A) => Coroutine<S, E, B>) => Coroutine<S, E, B>
    flatMap: <B>(f: (_: A) => Coroutine<S, E, B>) => Coroutine<S, E, B>

    unsafeRun: (s: S) => Either<Coroutine<S, E, A>, Pair<A, S>>

    repeat: <S, E>(count: number) => Coroutine<S, E, Unit>
    repeatWhile: <S, E>(p: (_: S) => boolean) => Coroutine<S, E, Unit>
    repeatUntil: <S, E>(p: (_: S) => boolean) => Coroutine<S, E, Unit>

    collectWhile: <S, E, A>(p: (_: S) => boolean) => Coroutine<S, E, List<A>>
    collectUntil: <S, E, A>(p: (_: S) => boolean) => Coroutine<S, E, List<A>>

    replicate: <S, E, A>(count: number) => List<Coroutine<S, E, A>>

    raceAgainst: <S, E, A, A1>(competitor: Coroutine<S, E, A1>) => Coroutine<S, E, Either<A, A1>>

    zip: <A1>(tail: Coroutine<S, E, A1>) => Coroutine<S, E, Pair<A, A1>>

    suspending: <S, E>() => Coroutine<S, E, Unit>
    unit: <S, E>() => Coroutine<S, E, Unit>

    orElse: <S, E, A>(alternative: Coroutine<S, E, A>) => Coroutine<S, E, A>
}

// The `Coroutine` type, which is the composition of the monadic `CoroutineM`
// definition and the inherited behaviours from `CoroutineOps`.
export type Coroutine<S, E, A> = CoroutineM<S, E, A> & CoroutineOps<S, E, A>

// NoRes is an indicator of the `Coroutine` type either continuing its computation
// through another coroutine, or, having failed to compute a value entirely.
type NoRes<S, E, A> = Either<E, Continuation<S, E, A>>

// `Continuation` is the symbolic representation of the rest of the monadic `Coroutine`
// program. A `Continuation` is modeled as a `Pair` of `S` and  `Coroutine`, where `S`
// is the current state in the computation and the `Coroutine` representing the remaining
// part of the computational program.
interface Continuation<S, E, A> extends Pair<S, Coroutine<S, E, A>> { }

// Constructs a `Coroutine` type from the given `CoroutineM` definition.
let Coroutine = <S, E, A>(c: CoroutineM<S, E, A>): Coroutine<S, E, A> => {
    return {
        ...c,

        map: function<S, E, A, B>(this: Coroutine<S, E, A>, f: (_: A) => B): Coroutine<S, E, B> {
            return map_Coroutine<S, E, A, B>(Func(a => f(a))).invoke(this)
        },

        bind: function<B>(this: Coroutine<S, E, A>, f: (_: A) => Coroutine<S, E, B>): Coroutine<S, E, B> {
            return bind_Coroutine<S, E, A, B>(Func(a => f(a))).invoke(this)
        },

        flatMap: function<B>(this: Coroutine<S, E, A>, f: (_: A) => Coroutine<S, E, B>): Coroutine<S, E, B> {
            return this.bind(f)
        },

        unsafeRun: function(this: Coroutine<S, E, A>, s: S): Either<Coroutine<S, E, A>, Pair<A, S>> {
            return unsafeRun(this, s)
        },

        repeat: function<S, E, A>(this: Coroutine<S, E, A>, count: number): Coroutine<S, E, Unit> {
            return repeat(count, this)
        },

        repeatWhile: function<S, E, A>(this: Coroutine<S, E, A>, p: (_: S) => boolean): Coroutine<S, E, Unit> {
            return repeatWhile(p, this)
        },

        repeatUntil: function<S, E, A>(this: Coroutine<S, E, A>, p: (_: S) => boolean): Coroutine<S, E, Unit> {
            return repeatUntil(p, this)
        },

        collectWhile: function<S, E, A>(this: Coroutine<S, E, A>, p: (_: S) => boolean): Coroutine<S, E, List<A>> {
            return collectWhile(p, this)
        },

        collectUntil: function<S, E, A>(this: Coroutine<S, E, A>, p: (_: S) => boolean): Coroutine<S, E, List<A>> {
            return collectUntil(p, this)
        },

        replicate: function<S, E, A>(this: Coroutine<S, E, A>, count: number): List<Coroutine<S, E, A>> {
            return replicate(count, this)
        },

        raceAgainst: function<S, E, A, A1>(this: Coroutine<S, E, A>, competitor: Coroutine<S, E, A1>): Coroutine<S, E, Either<A, A1>> {
            return race<S, E, A, A1>(this, competitor)
        },

        zip: function<A1>(this: Coroutine<S, E, A>, tail: Coroutine<S, E, A1>): Coroutine<S, E, Pair<A, A1>> {
            return this.bind(a => tail.bind(a1 => succeed(Pair(a, a1))))
        },

        suspending: function<S, E>(this: Coroutine<S, E, A>): Coroutine<S, E, Unit> {
            return this.bind(a => suspend<S, E>())
        },

        unit: function<S, E>(this: Coroutine<S, E, A>): Coroutine<S, E, Unit> {
            return this.map<S, E, A, Unit>(a => ({}))
        },

        orElse: function<S, E, A>(this: Coroutine<S, E, A>, alternative: Coroutine<S, E, A>): Coroutine<S, E, A> {
            return orElse(this, alternative)
        }
    }
}

// map_Coroutine performs a transformation of `Coroutine<S, E, A>` to `Coroutine<S, E, B>`.
let map_Coroutine = <S, E, A, B>(f: Func<A, B>): Func<Coroutine<S, E, A>, Coroutine<S, E, B>> =>
    Func(c1 => Coroutine(Func(state => {
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
    })))

// join_Coroutine flattens a nested `Coroutine` type into a single-level `Coroutine`.
let join_Coroutine = <S, E, A>(): Func<Coroutine<S, E, Coroutine<S, E, A>>, Coroutine<S, E, A>> =>
    Func(nested => Coroutine<S, E, A>(Func(state => {
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
    })))

// bind_Coroutine binds a `Coroutine<S, E, A>` to a `Coroutine<S, E, B>`, sequencing the  computation in order.
let bind_Coroutine = <S, E, A, B>(f: Func<A, Coroutine<S, E, B>>): Func<Coroutine<S, E, A>, Coroutine<S, E, B>> =>
    map_Coroutine<S, E, A, Coroutine<S, E, B>>(f).andThen(join_Coroutine())

// succeed eagerly lifts the input value of `A`, into a successfully completed `Coroutine`. Do NOT pass
// in values (e.g through a function call) that can throw exceptions as this CAN cause undefined behaviour.
let succeed = <S, E, A>(a: A): Coroutine<S, E, A> =>
    Coroutine(Func(state => right<NoRes<S, E, A>, Pair<A, S>>().invoke(Pair<A, S>(a, state))))

// suspend returns a suspended `Coroutine` that does nothing until it is resumed.
let suspend = <S, E>(): Coroutine<S, E, Unit> =>
    Coroutine(Func(state => left<NoRes<S, E, Unit>, Pair<Unit, S>>()
        .invoke(right<E, Continuation<S, E, Unit>>()
        .invoke({ fst: state, snd: succeed<S, E, Unit>(({}))}))))

// fail lifts an error value of `E`, into a `Coroutine` that has failed to produce a value,
// thus returning the lifted value of `E`.
let fail = <S, E, A>(e: E): Coroutine<S, E, A> =>
    Coroutine(Func(state => left<NoRes<S, E, A>, Pair<A, S>>()
        .invoke(left<E, Continuation<S, E, A>>()
        .invoke(e))))

// effect lifts the effect of `f` into a Coroutine. Unlike the `compute` operator, this operator
// does not operate on a state and can be used for effects such as  database calls, network / file IO, etc.
// Exceptions thrown in the given computation are safely captured.
let effect = <E, A>(f: (_: Unit) => A): Coroutine<Unit, E, A> =>
    compute<Unit, E, A>(s => f({}))

// transform lifts the specified transformation of `f`, from one instance of `S` to another instance of `S`.
// Exceptions thrown in the given computation are safely captured.
let transform = <S, E>(f: (_: S) => S): Coroutine<S, E, S> =>
    Coroutine(Func(state => {
        try {
            let newState = f(state)
            return right<NoRes<S, E, S>, Pair<S, S>>().invoke(Pair<S, S>(newState, newState))
        } catch (e) {
            return left<NoRes<S, E, S>, Pair<S, S>>().invoke(left<E, Continuation<S, E, S>>().invoke(e))
        }
    }))

// compute lifts the specified computation of `f` into a Coroutine. Unlike the `transform` variant, this
// operator only uses the State for reading purposes. New state cannot evolve during this computation.
// Exceptions thrown in the given computation are safely captured.
let compute = <S, E, A>(f: (_: S) => A): Coroutine<S, E, A> =>
    Coroutine(Func(state => {
        try {
            return right<NoRes<S, E, A>, Pair<A, S>>().invoke(Pair<A, S>(f(state), state))
        } catch (e) {
            return left<NoRes<S, E, A>, Pair<A, S>>().invoke(left<E, Continuation<S, E, A>>().invoke(e))
        }
    }))

// Puts the given text line into the console.
let putStrLn = <S, E>(text: string): Coroutine<S, E, void> =>
    compute<S, E, void>(state => console.log(text))

// fromOption lifts the given `Option` type into a `Coroutine`.
let fromOption = <S, A>(opt: Option<A>): Coroutine<S, Unit, A> =>
    opt.kind == "none" ? fail({}) : succeed(opt.value)

// fromEither lifts the given `Either` type into a `Coroutine`.
let fromEither = <S, E, A>(either: Either<E, A>): Coroutine<S, E, A> =>
    either.kind == "left" ? fail(either.value) : succeed(either.value)

// Sequences over the given `List` of `Coroutine`s, inverting the `List` into a `Coroutine`
// that produces a `List` of values of `A`.
let sequence = <S, E, A>(l: List<Coroutine<S, E, A>>): Coroutine<S, E, List<A>> =>
    Coroutine(Func(state => { // TODO do this the purely functional way
        let results = List.of<A>()
        for (let coroutine of l.toArray()) {
            let effectResult = coroutine.invoke(state)
            if (effectResult.kind == "right") {
                results.push(effectResult.value.fst)
            } else {
                let suspensionOrFail = effectResult.value
                if (suspensionOrFail.kind == "left") {
                    return fail<S, E, List<A>>(suspensionOrFail.value).invoke(state)
                } else { // TODO what to do when the Coroutine is suspended?
                    throw new Error("TODO")
                }
            }
        }

        return succeed<S, E, List<A>>(results).invoke(state)
    }))

// Applies the given function of `f` for every element in the given `List` of `A`s, which is to
// return a `Coroutine` that produces a `List` of values that the given function of `f` produces
// for every element in the given `List`.
let forEach = <S, E, A, A1>(l: List<A>) => (f: (_: A) => Coroutine<S, E, A1>): Coroutine<S, E, List<A1>> =>
    Coroutine(Func(state => sequence(l.map((v, k) => f(v))).invoke(state)))

// orElse provides an alternative `Coroutine` strategy to invoke if the given attempted `Coroutine`
// has failed to produce a result. A failure is accepted as both an exception and any other kind of
// error of `E`.
let orElse = <S, E, A>(attempting: Coroutine<S, E, A>, alternative: Coroutine<S, E, A>): Coroutine<S, E, A> =>
    Coroutine(Func(state => { // TODO refactor
        let result = attempting.invoke(state)
        if (result.kind != "left" || result.value.kind == "right") {
            return result
        }

        return alternative.invoke(state)
    }))

// Replicates the given `Coroutine` the specified amount of times, returning a `List`
// with the given `Coroutine`, 
let replicate = <S, E, A>(count: number, c: Coroutine<S, E, A>): List<Coroutine<S, E, A>> =>
    count <= 0 ? List.of() : List.of(c).concat(replicate<S, E, A>(count - 1, c))

// wait constructs a delay of the specified amount of ticks.
let wait = <S>(ticks: number): Coroutine<S, Unit, Unit> =>
    ticks <= 0 ? succeed<S, Unit, Unit>({}) : suspend<S, Unit>().bind<Unit>(() => wait<S>(ticks - 1))

// `race` lets two given `Coroutine`s race it out, returning the result of the first `Coroutine` that completes its course.
// The execution is interrupted if an error was raised from either executed coroutines.
let race = <S, E, A, A1>(fst: Coroutine<S, E, A>, snd: Coroutine<S, E, A1>): Coroutine<S, E, Either<A, A1>> =>
    Coroutine(Func(state => {
        let firstResult = fst.invoke(state)
        if (firstResult.kind == "left" && firstResult.value.kind == "left") { // first Coroutine has failed.
            return fail<S, E, Either<A, A1>>(firstResult.value.value).invoke(state)
        } else {
            let secondResult = snd.invoke(state)
            if (secondResult.kind == "left" && secondResult.value.kind == "left") { // second Coroutine has failed.
                return fail<S, E, Either<A, A1>>(secondResult.value.value).invoke(state)
            } else if (firstResult.kind == "right" && secondResult.kind == "left") { // only the first one is done
                return succeed<S, E, Either<A, A1>>(left<A, A1>().invoke(firstResult.value.fst)).invoke(state)
            } else if (firstResult.kind == "left" && secondResult.kind == "right") { // only the second one is done
                return succeed<S, E, Either<A, A1>>(right<A, A1>().invoke(secondResult.value.fst)).invoke(state)
            } else if (firstResult.kind == "right" && secondResult.kind == "right") { // both are done
                // emulating the behaviour of JavaScript's Promise.race(), return the first passed
                // in Coroutine if both coroutines have completed their course.
                return succeed<S, E, Either<A, A1>>(left<A, A1>().invoke(firstResult.value.fst)).invoke(state)
            } else if (firstResult.kind == "left" && secondResult.kind == "left") { // neither are done
                // both Coroutines are suspended
                if (firstResult.value.kind == "right" && secondResult.value.kind == "right") {
                    return race<S, E, A, A1>(firstResult.value.value.snd, secondResult.value.value.snd).invoke(state)
                }
                
                // only the first Coroutine is suspended
                if (firstResult.value.kind == "right") {
                    return race<S, E, A, A1>(firstResult.value.value.snd, snd).invoke(state)
                }
                
                // only the second Coroutine is suspended
                if (secondResult.value.kind == "right") {
                    return race<S, E, A, A1>(fst, secondResult.value.value.snd).invoke(state)
                }
            }

            throw new Error("UnsupportedOperation")
        }
    }))

// Repeats the given procedure the specified amount of times, essentially producing a `Coroutine` that has
// binded the given `Coroutine` procedure `count` times.
let repeat = <S, E, A>(count: number, procedure: Coroutine<S, E, A>): Coroutine<S, E, Unit> =>
    count <= 0 ? succeed({}) : procedure.bind(() => repeat(count - 1, procedure))

// Repeatedly executes the given `Coroutine` process as long as the given predicate of `p` is satisfied.
// The execution is interrupted if an error was raised from the executed `process` coroutine.
let repeatWhile = <S, E, A>(p: (_: S) => boolean, procedure: Coroutine<S, E, A>): Coroutine<S, E, Unit> =>
    Coroutine(Func(state => (!p(state) ? succeed<S, E, Unit>({}) : procedure.bind(() => repeatWhile(p, procedure))).invoke(state)))

// Repeatedly executes the given `Coroutine` process until the given predicate of `p` is satisfied.
// The execution is interrupted if an error was raised from the executed `process` coroutine.
let repeatUntil = <S, E, A>(p: (_: S) => boolean, procedure: Coroutine<S, E, A>): Coroutine<S, E, Unit> =>
    Coroutine(Func(state => (p(state) ? succeed<S, E, Unit>({}) : procedure.bind(() => repeatUntil(p, procedure))).invoke(state)))

// Repeatedly executes the given `Coroutine` procedure, collecting each result as long as the given predicate
// of `p` is satisfied. The execution is interrupted if an error was raised from the executed `process` coroutine.
let collectWhile = <S, E, A>(p: (_: S) => boolean, procedure: Coroutine<S, E, A>): Coroutine<S, E, List<A>> =>
    Coroutine(Func(state => (!p(state) ? succeed<S, E, List<A>>(List.of<A>()) : procedure
        .bind(value => collectWhile<S, E, A>(p, procedure)
        .map<S, E, List<A>, List<A>>(list => List.of(value).concat(list))))
        .invoke(state)))

// Repeatedly executes the given `Coroutine` procedure, collecting each result until the given predicate
// of `p` is satisfied. The execution is interrupted if an error was raised from the executed `process` coroutine.
let collectUntil = <S, E, A>(p: (_: S) => boolean, procedure: Coroutine<S, E, A>): Coroutine<S, E, List<A>> =>
    Coroutine(Func(state => (p(state) ? succeed<S, E, List<A>>(List.of<A>()) : procedure
        .bind(value => collectUntil<S, E, A>(p, procedure)
        .map<S, E, List<A>, List<A>>(list => List.of(value).concat(list))))
        .invoke(state)))

// Unsafely invokes the given `Coroutine` with the given state of `S`. May throw an exception.
let unsafeRun = <S, E, A>(coroutine: Coroutine<S, E, A>, s: S): Either<Coroutine<S, E, A>, Pair<A, S>> => {
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