# Coroutine Monad in TypeScript

A purely functional implementation of the Coroutine monad in TypeScript, inspired by Haskell's monadic [Coroutine](http://hackage.haskell.org/package/monad-coroutine-0.9.0.4/docs/Control-Monad-Coroutine.html) and [IO](https://wiki.haskell.org/IO_inside) and Scala's [Cats IO](https://typelevel.org/cats-effect/datatypes/io.html) and [ZIO](https://zio.dev/) implementations.

## How does it work?

In essence, a Coroutine is nothing more but a building block that is used to break down algorithms into steps that can be scheduled and ran at different points in time. It works similarily to an iterator, which has client code call next on the iterator to provide the next value in the collection. The key difference here, is that the Coroutine safely captures errors and is lazily evaluated. Lazy evaluation is achieved through wrapping of effects, which turns entire programs into values. With each effect being wrapped, we form a chain of actions that we have more fine-grained control over. This is useful for applications such as games, which often suffer from many CPU-intensive algorithms running all at once, which may affect the frame rate of the graphics rendering. By using an ancient concept known as coroutines, these algorithms can be broken down into 'simulation steps' and scheduled to run at some point in time to retain a healthy frame rate.

The generic type signature of the `Coroutine` is as followed:

```typescript
type Coroutine<S, E, A>
```

Where:

- `S` stands for the state the `Coroutine` is to operate on.
- `E` represents the type of error the algorithm may raise (should one occur)
- `A` is the type of result the algorithm produces.

## Effect

The basic usage is to wrap your algorithm with the `effect`, `transform` or `compute` operators. For example:

```typescript
let program = compute<MyCounter, string, number>(s => s.count + 1)
```

However, the reality is that programs are instructions that run one after another. So we need a way to run effects in a sequence. This can be achieved through the `bind` operator:

```typescript
let program = locateToilet()
    .bind(toiletLocation => walkTo(toiletLocation)
    .bind(() => faceToilet(toiletLocation)))
```

The `flatMap` alias for `bind` is also provided.

Should you already have a value, it can be lifted into a `Coroutine` through the `succeed` operator:

```typescript
let program = succeed({ id: 1, name: "John", surName: "Doe" })
```

Note however that invoking an unsafe function to produce a value to pass to the `Coroutine`, may cause undefined behaviour.

Constructor support for the `Option` and `Either` types is also provided:

```typescript
let programA: Coroutine<MyState, Unit, number> = fromOption(Some(1))
let programB: Coroutine<MyState, string, number> = fromEither(left().invoke("Failed!"))
```

A `Coroutine` can also be created in a failed state:

```typescript
let program = fail<Unit, string, number>("BOOM!!")
```

In some cases, you may want to apply an effect onto each element in a `List`. This is possible through `forEach`:

```typescript
let double = (n: number) => succeed(n * 2)

let values = List.of(1, 2, 3, 4)
let program: Coroutine<Unit, Unit, List<number>> = forEach<Unit, Unit, number, number>(values)(number => double(number))
```

Alternative strategies are also supported, through the `orElse` operator:

```typescript
let getAccountFromDb = (id: AccountId): Coroutine<Unit, AccountError, Option<Account>> => throw new Error("TODO")
let getAccountFromMemStore = (id: AccountId): Coroutine<Unit, AccountError, Option<Account>> => throw new Error("TODO")

let program = getAccountFromMemStore(id).orElse(getAccountFromDb(id))
```

You can also zip an effect with another, creating a `Coroutine` that produces a `Pair` of the two produced values.

```typescript
let program: Coroutine<State, string, Pair<ResultA, ResultB>> = programA.zip(programB)
```

The `zip` combinator, does operate sequentially however. The combined effect will return an error if either side fails.

## Repetition

Coroutines can be repeated until a given state meets a specified predicate:

```typescript
program.repeatUntil<MyCounter, string>(s => s.count >= 10)
```

An effect can also be replicated numerous times:

```typescript
let program: List<Coroutine<MyCounter, string, number>> = myEffect.replicate(10)
```

## Interruptions

Coroutines are built for cooperative interruptions, which are often labelled as suspensions, to allow CPU-intensive programs to consist of simulation steps that can be ran, interrupted and resumed later in time.

```typescript
let program = putStrLn("First print!")
    .suspending()
    .bind(() => putStrLn("Second print!"))
    .suspending()
    .bind(() => putStrLn("Third print!"))
```

The program described above when executed, first prints the 'First print!', suspends once and when resumed again, it is to print 'Second print!' and then suspends yet again and when finally resumed, it is to print 'Third print' which is to finish our program.

## Delays

Delays are also supported, which allow you to delay effects for a certain amount of time.

```typescript
let program = delay(5).bind(() => putStrLn("Hello World"))
```

The program described above, delays for five ticks and then prints `Hello World`. But how does this work? Does the library have its own scheduler? No, it does not. That is completely up to you. You decide when in time, the effect should resolve because, under the hood, the `delay` call does nothing but suspend N times.

## Concurrency

Effects can also be raced:

```typescript
let programA = delay(3).bind(() => succeed(1))
let programB = delay(5).bind(() => succeed(2))
let program = programA.raceAgainst(programB)
```

## Interpretation

In functional programming, the idea is to push all unsafe operations towards the edge of the world (such as your entry point). This way, the rest of your application can remain pure, referentially transparent and most important of all, composable. Now that you've learned how to build programs out of `Coroutine`s, you need to interpret them. This can be done by calling `unsafeRun` on your `Coroutine`, which will return either a suspension point or the final result of the `Coroutine`:

```typescript
let program: Coroutine<Unit, string, SomeValue> = fail("BOOM!")
let result = program.unsafeRun({}) // throws an error here and thus never reaches the condition below.
if (result.kind == "left") {
    // our program has reached a suspension point.
} else {
    // our program has succeeded!
}
```

Note that errors of type `E` captured by the `Coroutine` are provided as part of a thrown `Error` within the error message when `unsafeRun` is called.