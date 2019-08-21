# Coroutine Monad in TypeScript

A purely functional implementation of the Coroutine monad in TypeScript, inspired by Haskell's monadic Coroutine and IO and Scala's Cats IO and ZIO implementations.

## How does it work?

In essence, a Coroutine is nothing more but a building block that is used to break down algorithms into steps that can be scheduled and ran at different points in time. It works similarily to an iterator, which has client code call next on the iterator to provide the next value in the collection. The key difference here, is that the Coroutine safely captures errors and is lazily evaluated. Laziness allows applications to have an interpreter at the edge of their world which is to resume a Coroutine at some point in time. This is useful for applications such as games, which often suffer from many CPU-intensive algorithms running all at once, which may affect the frame rate of the graphics rendering. By using an ancient concept known as coroutines, these algorithms can be broken down into 'simulation steps' and scheduled to run at some point in time to retain a healthy frame rate.

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

Alternative strategies are also supported, through the `orElse` operator:

```typescript
let getAccountFromDb = (id: AccountId): Coroutine<Unit, AccountError, Option<Account>> => throw new Error("TODO")
let getAccountFromMemStore = (id: AccountId): Coroutine<Unit, AccountError, Option<Account>> => throw new Error("TODO")

let program = getAccountFromMemStore(id).orElse(getAccountFromDb(id))
```

However, we do need a way to run effects in a sequence. This can be achieved through the `bind` operator:

```typescript
let program = locateToilet()
    .bind(toiletLocation => walkTo(toiletLocation)
    .bind(() => faceToilet(toiletLocation)))
```

The `flatMap` alias for `bind` is also provided.

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
let programA = delay(3).bind(() => completed(1))
let programB = delay(5).bind(() => completed(2))
let program = programA.raceAgainst(programB)
```