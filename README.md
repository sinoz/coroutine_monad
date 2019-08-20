# Coroutine Monad in TypeScript

A purely functional implementation of the Coroutine monad in TypeScript, inspired by Haskell's monadic Coroutine and IO
and Scala's Cats IO and ZIO implementations.

## Sample Usage

Coroutines are built for cooperative interruptions, which are often labelled as suspensions, to allow CPU-intensive programs to consist of simulation steps that can be ran, interrupted and resumed later in time.

```
let program = putStrLn("First print!")
    .suspending()
    .bind(() => putStrLn("Second print!"))
    .suspending()
    .bind(() => putStrLn("Third print!"))
```