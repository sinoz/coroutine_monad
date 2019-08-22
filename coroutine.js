"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
exports.__esModule = true;
var either_1 = require("./either");
var func_1 = require("./func");
var pair_1 = require("./pair");
var immutable_1 = require("immutable");
// Constructs a `Coroutine` type from the given `CoroutineM` definition.
var Coroutine = function (c) {
    return __assign({}, c, { map: function (f) {
            return map_Coroutine(func_1.Func(function (a) { return f(a); })).invoke(this);
        }, bind: function (f) {
            return bind_Coroutine(func_1.Func(function (a) { return f(a); })).invoke(this);
        }, flatMap: function (f) {
            return this.bind(f);
        }, unsafeRun: function (s) {
            return unsafeRun(this, s);
        }, repeat: function (count) {
            return repeat(count, this);
        }, repeatWhile: function (p) {
            return repeatWhile(p, this);
        }, repeatUntil: function (p) {
            return repeatUntil(p, this);
        }, replicate: function (count) {
            return replicate(count, this);
        }, raceAgainst: function (competitor) {
            return race(this, competitor);
        }, zip: function (tail) {
            return this.bind(function (a) { return tail.bind(function (a1) { return succeed_Coroutine(pair_1.Pair(a, a1)); }); });
        }, suspending: function () {
            return this.bind(function (a) { return suspend(); });
        }, unit: function () {
            return this.map(function (a) { return ({}); });
        }, orElse: function (alternative) {
            return orElse(this, alternative);
        } });
};
// map_Coroutine performs a transformation of `Coroutine<S, E, A>` to `Coroutine<S, E, B>`.
var map_Coroutine = function (f) {
    return func_1.Func(function (c1) { return Coroutine(func_1.Func(function (state) {
        // Invoke the coroutine to find out its current state (continued, failed or succeeded).
        var processState = c1.invoke(state);
        // Then check if the coroutine has a continuation, has failed or if it has a result.
        if (processState.kind == "left") {
            var failedOrContinuous = processState.value;
            // Coroutine has a continuation or has failed. So now we have to check which one it is.
            if (failedOrContinuous.kind == "left") {
                // Coroutine has failed to process a result.
                var errorValue = failedOrContinuous.value;
                return either_1.left()
                    .andThen(either_1.left())
                    .invoke(errorValue);
            }
            else {
                // Coroutine has a continuation.
                var suspensionValue = failedOrContinuous.value;
                return pair_1.map_Pair(func_1.identity(), map_Coroutine(f))
                    .andThen(either_1.right())
                    .andThen(either_1.left())
                    .invoke(suspensionValue);
            }
        }
        else { // The coroutine has successfully computed a result!
            var computedValue = processState.value;
            return pair_1.map_Pair(f, func_1.identity())
                .andThen(either_1.right())
                .invoke(computedValue);
        }
    })); });
};
// join_Coroutine flattens a nested `Coroutine` type into a single-level `Coroutine`.
var join_Coroutine = function () {
    return func_1.Func(function (nested) { return Coroutine(func_1.Func(function (state) {
        // Invoke the nested `Coroutine` to find out its current state (continued, failed or succeeded).
        var processState = nested.invoke(state);
        // Then check if the coroutine has a continuation, has failed or if it has a result.
        if (processState.kind == "left") {
            var failedOrContinuous = processState.value;
            // Coroutine has a continuation or has failed. So now we have to check which one it is.
            if (failedOrContinuous.kind == "left") {
                // Coroutine has failed to process a result.
                return either_1.left()
                    .andThen(either_1.left())
                    .invoke(failedOrContinuous.value);
            }
            else {
                // Coroutine has a continuation.
                var continuation = failedOrContinuous.value;
                return pair_1.map_Pair(func_1.identity(), join_Coroutine())
                    .andThen(either_1.right())
                    .andThen(either_1.left())
                    .invoke(continuation);
            }
        }
        else { // The coroutine has successfully computed a result!
            // extracts the result of the double layered `Coroutine`, which is another
            // `Coroutine` and a state of `S`.
            var computedValue = processState.value;
            // Extracts the `Coroutine` and the state of `S`.
            var next = computedValue.fst;
            var stateOfCoroutine = computedValue.snd;
            // And invoke that coroutine with that state
            return next.invoke(stateOfCoroutine);
        }
    })); });
};
// bind_Coroutine binds a `Coroutine<S, E, A>` to a `Coroutine<S, E, B>`, sequencing the  computation in order.
var bind_Coroutine = function (f) {
    return map_Coroutine(f).andThen(join_Coroutine());
};
// succeed_Coroutine eagerly lifts the input value of `A`, into a successfully completed `Coroutine`.
var succeed_Coroutine = function (a) {
    return Coroutine(func_1.Func(function (state) { return either_1.right().invoke(pair_1.Pair(a, state)); }));
};
// succeed is an alias for `succeed_Coroutine`. Do NOT pass in values (e.g through a function call)
// that can throw exceptions as this CAN cause undefined behaviour.
var succeed = function (a) {
    return succeed_Coroutine(a);
};
// suspend returns a suspended `Coroutine` that does nothing until it is resumed.
var suspend = function () {
    return Coroutine(func_1.Func(function (state) { return either_1.left()
        .invoke(either_1.right()
        .invoke({ fst: state, snd: succeed_Coroutine(pair_1.Pair({}, state)) })); }));
};
// fail lifts an error value of `E`, into a `Coroutine` that has failed to produce a value,
// thus returning the lifted value of `E`.
var fail = function (e) {
    return Coroutine(func_1.Func(function (state) { return either_1.left()
        .invoke(either_1.left()
        .invoke(e)); }));
};
// effect lifts the effect of `f` into a Coroutine. Unlike the `compute` operator, this operator
// does not operate on a state and can be used for effects such as  database calls, network / file IO, etc.
// Exceptions thrown in the given computation are safely captured.
var effect = function (f) {
    return compute(function (s) { return f({}); });
};
// transform lifts the specified transformation of `f`, from one instance of `S` to another instance of `S`.
// Exceptions thrown in the given computation are safely captured.
var transform = function (f) {
    return Coroutine(func_1.Func(function (state) {
        try {
            var newState = f(state);
            return either_1.right().invoke(pair_1.Pair(newState, newState));
        }
        catch (e) {
            return either_1.left().invoke(either_1.left().invoke(e));
        }
    }));
};
// compute lifts the specified computation of `f` into a Coroutine. Unlike the `transform` variant, this
// operator only uses the State for reading purposes. New state cannot evolve during this computation.
// Exceptions thrown in the given computation are safely captured.
var compute = function (f) {
    return Coroutine(func_1.Func(function (state) {
        try {
            return either_1.right().invoke(pair_1.Pair(f(state), state));
        }
        catch (e) {
            return either_1.left().invoke(either_1.left().invoke(e));
        }
    }));
};
// Puts the given text line into the console.
var putStrLn = function (text) {
    return compute(function (state) { return console.log(text); });
};
// fromOption lifts the given `Option` type into a `Coroutine`.
var fromOption = function (opt) {
    return opt.kind == "none" ? fail({}) : succeed_Coroutine(opt.value);
};
// fromEither lifts the given `Either` type into a `Coroutine`.
var fromEither = function (either) {
    return either.kind == "left" ? fail(either.value) : succeed_Coroutine(either.value);
};
// Sequences over the given `List` of `Coroutine`s, inverting the `List` into a `Coroutine`
// that produces a `List` of values of `A`.
var sequence = function (l) {
    return Coroutine(func_1.Func(function (state) {
        var results = immutable_1.List.of();
        for (var _i = 0, _a = l.toArray(); _i < _a.length; _i++) {
            var coroutine = _a[_i];
            var effectResult = coroutine.invoke(state);
            if (effectResult.kind == "right") {
                results.push(effectResult.value.fst);
            }
            else {
                var suspensionOrFail = effectResult.value;
                if (suspensionOrFail.kind == "left") {
                    return fail(suspensionOrFail.value).invoke(state);
                }
                else { // TODO what to do when the Coroutine is suspended?
                    throw new Error("TODO");
                }
            }
        }
        return succeed_Coroutine(results).invoke(state);
    }));
};
// Applies the given function of `f` for every element in the given `List` of `A`s, which is to
// return a `Coroutine` that produces a `List` of values that the given function of `f` produces
// for every element in the given `List`.
var forEach = function (l) { return function (f) {
    return Coroutine(func_1.Func(function (state) { return sequence(l.map(function (v, k) { return f(v); })).invoke(state); }));
}; };
// orElse provides an alternative `Coroutine` strategy to invoke if the given attempted `Coroutine`
// has failed to produce a result. A failure is accepted as both an exception and any other kind of
// error of `E`.
var orElse = function (attempting, alternative) {
    return Coroutine(func_1.Func(function (state) {
        var result = attempting.invoke(state);
        if (result.kind != "left" || result.value.kind == "right") {
            return result;
        }
        return alternative.invoke(state);
    }));
};
// Replicates the given `Coroutine` the specified amount of times, returning a `List`
// with the given `Coroutine`, 
var replicate = function (count, c) {
    return count <= 0 ? immutable_1.List.of() : immutable_1.List.of(c).concat(replicate(count - 1, c));
};
// wait constructs a delay of the specified amount of ticks.
var wait = function (ticks) {
    return ticks <= 0 ? succeed_Coroutine({}) : suspend().bind(function () { return wait(ticks - 1); });
};
// `race` lets two given `Coroutine`s race it out, returning the result of the first `Coroutine` that completes its course.
// The execution is interrupted if an error was raised from either executed coroutines.
var race = function (fst, snd) {
    return Coroutine(func_1.Func(function (state) {
        var firstResult = fst.invoke(state);
        if (firstResult.kind == "left" && firstResult.value.kind == "left") { // first Coroutine has failed.
            return fail(firstResult.value.value).invoke(state);
        }
        var secondResult = snd.invoke(state);
        if (secondResult.kind == "left" && secondResult.value.kind == "left") { // second Coroutine has failed.
            return fail(secondResult.value.value).invoke(state);
        }
        // only the first one is done
        if (firstResult.kind == "right" && secondResult.kind == "left") {
            return succeed_Coroutine(either_1.left().invoke(firstResult.value.fst)).invoke(state);
        }
        // only the second one is done
        if (firstResult.kind == "left" && secondResult.kind == "right") {
            return succeed_Coroutine(either_1.right().invoke(secondResult.value.fst)).invoke(state);
        }
        // both are done
        if (firstResult.kind == "right" && secondResult.kind == "right") {
            // emulating the behaviour of JavaScript's Promise.race(), return the first passed
            // in Coroutine if both coroutines have completed their course.
            return succeed_Coroutine(either_1.left().invoke(firstResult.value.fst)).invoke(state);
        }
        // neither are done
        if (firstResult.kind == "left" && secondResult.kind == "left") {
            // both Coroutines are suspended
            if (firstResult.value.kind == "right" && secondResult.value.kind == "right") {
                return race(firstResult.value.value.snd, secondResult.value.value.snd).invoke(state);
            }
            // only the first Coroutine is suspended
            if (firstResult.value.kind == "right") {
                return race(firstResult.value.value.snd, snd).invoke(state);
            }
            // only the second Coroutine is suspended
            if (secondResult.value.kind == "right") {
                return race(fst, secondResult.value.value.snd).invoke(state);
            }
        }
    }));
};
// Repeats the given procedure the specified amount of times, essentially producing a `Coroutine` that has
// binded the given `Coroutine` procedure `count` times.
var repeat = function (count, procedure) {
    return count <= 0 ? succeed_Coroutine({}) : procedure.bind(function () { return repeat(count - 1, procedure); });
};
// repeatWhile repeatedly executes the given `Coroutine` process as long as the given predicate of `p` is satisfied.
// The execution is interrupted if an error was raised from the executed `process` coroutine.
var repeatWhile = function (p, procedure) {
    return Coroutine(func_1.Func(function (state) { return (!p(state) ? succeed({}) : procedure.bind(function () { return repeatWhile(p, procedure); })).invoke(state); }));
};
// repeatUntil repeatedly executes the given `Coroutine` process until the given predicate of `p` is satisfied.
// The execution is interrupted if an error was raised from the executed `process` coroutine.
var repeatUntil = function (p, procedure) {
    return Coroutine(func_1.Func(function (state) { return (p(state) ? succeed({}) : procedure.bind(function () { return repeatUntil(p, procedure); })).invoke(state); }));
};
// Unsafely invokes the given `Coroutine` with the given state of `S`. May throw an exception.
var unsafeRun = function (coroutine, s) {
    var result = coroutine.invoke(s);
    if (result.kind == "right") {
        return either_1.right().invoke(result.value);
    }
    else {
        if (result.value.kind == "left") {
            throw new Error("Coroutine failed with: " + result.value.value);
        }
        else {
            return either_1.left().invoke(result.value.value.snd);
        }
    }
};
