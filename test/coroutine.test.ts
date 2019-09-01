import { expect } from "chai"
import { describe, it } from "mocha"
import { Some, None } from "../src/option"
import { Unit } from "../src/func"
import { unsafeRun, unsafeRunGetValue } from "../src/runtime"
import {
  Coroutine,
  succeed,
  fail,
  suspend,
  effect,
  wait,
  transform,
  compute,
  fromOption,
  fromEither
} from "../src/coroutine"
import { left, right } from "../src/either";

describe('Coroutine constructors', function () {
  it('succeed', function () {
    let result = unsafeRunGetValue(succeed<number, never, number>(10), 1)
    expect(result.fst).equal(10);
  });

  it('suspend', function () {
    let result = unsafeRun(suspend<number, string>(), 1)

    // `unsafeRun` throws an exception if the `Coroutine` had failed so merely checking
    // if the kind of result is 'left', will suffice.
    expect(result.kind).equal("left");
  });

  it('fail', function () {
    expect(() => unsafeRun(fail<number, string, boolean>("Error!"), 1)).to.throw(Error);
  });

  it('effect', function () {
    let result = unsafeRunGetValue(effect<never, string>(() => "y"), {})
    expect(result.fst).equal("y");
  });

  it('effectError', function () {
    expect(() => unsafeRun(effect<Error, boolean>(s => { throw new Error() }), ({}))).to.throw(Error);
  });

  it('transform', function () {
    let result = unsafeRunGetValue(transform<string, never>(s => s + "y"), "x")
    expect(result.fst).equal("xy");
  });

  it('transformError', function () {
    expect(() => unsafeRun(transform<number, Error>(s => { throw new Error() }), 1)).to.throw(Error);
  });

  it('compute', function () {
    let result = unsafeRunGetValue(compute<number, never, number>(s => s + 1), 1)
    expect(result.fst).equal(2);
  });

  it('computeError', function () {
    expect(() => unsafeRun(compute<number, Error, number>(s => { throw new Error() }), 1)).to.throw(Error);
  });

  it('wait', function () {
    var program = wait(5)
    for (let i = 0; i < 5; i++) {
      let result = unsafeRun(program, {})

      expect(result.kind).equal("left")
      if (result.kind == "left") {
        program = result.value
      }
    }
  });

  it('waitAndSucceed', function () {
    var program = wait(10).bind(() => succeed(1))
    var finalResult = 0
    for (let i = 0; i < 11; i++) {
      let result = unsafeRun(program, {})
      if (i <= 9) {
        expect(result.kind).equal("left")
      } else {
        expect(result.kind).equal("right")
      }

      if (result.kind == "left") {
        program = result.value
      } else {
        finalResult = result.value.fst
      }
    }

    expect(finalResult).equal(1)
  });

  it('fromOptionNone', function () {
    expect(() => unsafeRun(fromOption(None()), {})).to.throw(Error)
  });

  it('fromOptionSome', function () {
    let result = unsafeRunGetValue(fromOption(Some(1)), {})
    expect(result.fst).equal(1);
  });

  it('fromEitherLeft', function () {
    expect(() => unsafeRun(fromEither(left().invoke("Error!")), {})).to.throw(Error)
  });

  it('fromEitherRight', function () {
    let result = fromEither(right().invoke(1)).invoke({})
    expect(result.kind).equal("right")
  });
});

describe('Coroutine combinators', function () {
  it('repeat', function () {
    var numericVar = 0
    let repetition = effect<never, void>(() => { numericVar++ }).repeat(10)

    unsafeRun(repetition, {})
    expect(numericVar).equal(10)
  });

  it('repeatUntil', function () {
    var numericVar = 0
    let repetition = effect<never, void>(() => { numericVar++ }).repeatUntil(() => numericVar >= 16)

    unsafeRun(repetition, {})
    expect(numericVar).equal(16)
  });

  it('repeatWhile', function () {
    var numericVar = 0
    let repetition = effect<never, void>(() => { numericVar++ }).repeatWhile(() => numericVar <= 16)

    unsafeRun(repetition, {})
    expect(numericVar).equal(17)
  });

  it('collectUntil', function () {
    let repetition = transform<number, never>(s => s + 1).collectUntil<number, never, number>(s => s >= 16)
    let result = unsafeRunGetValue(repetition, 0)

    let allNumbers = result.fst.toArray()
    for (let i = 1; i <= 16; i++) {
      expect(allNumbers[i - 1]).equal(i)
    }
  });

  it('collectWhile', function () {
    let repetition = transform<number, never>(s => s + 1).collectWhile<number, never, number>(s => s <= 32)
    let result = unsafeRunGetValue(repetition, 0)

    let allNumbers = result.fst.toArray()
    for (let i = 1; i <= 32; i++) {
      expect(allNumbers[i - 1]).equal(i)
    }
  });

  it('retry', function () {
    var numericVar = 0
    let repetition = effect<Error, string>(() => {
      numericVar++
      if (numericVar <= 5) {
        throw new Error("BOOM")
      }

      return "" + numericVar
    }).retry(10)

    unsafeRun(repetition, {})
    expect(numericVar).equal(6)
  });

  it('retryJustError', function () {
    let repetition = effect<Error, string>(() => { throw new Error("BOOM") }).retry(10)
    expect(() => unsafeRun(repetition, {})).to.throw(Error)
  });

  it('zip', function () {
    let programA = effect<string, number>(() => 64)
    let programB = effect<string, boolean>(() => true)
    let combined = programA.zip(programB)
    let result = unsafeRunGetValue(combined, {})
    
    expect(result.fst.fst).equal(64)
    expect(result.fst.snd).equal(true)
  });

  it('orElse', function () {
    let programA = effect<string, number>(() => { throw new Error() })
    let programB = effect<string, number>(() => 72)

    let withAlternative = programA.orElse(programB)
    let result = unsafeRunGetValue(withAlternative, {})
    
    expect(result.fst).equal(72)
  });

  it('raceAgainst', function () {
    let programA = wait<Unit>(5).bind(() => succeed("A"))
    let programB = wait<Unit>(3).bind(() => succeed("B"))

    var program = programA.raceAgainst(programB)
    for (let i = 0; i < 5; i++) {
      let result = unsafeRun(program, {})
      if (result.kind == "left") {
        program = result.value
      } else if (result.kind == "right") {
        let win = result.value.fst
        if (win.kind == "left") {
          expect(win.value).equal("A")
        } else {
          expect(win.value).equal("B")
        }

        break
      }
    }
  });

  it('inParallelWith', function () {
    let programA = wait<Unit>(5).bind(() => succeed("A"))
    let programB = wait<Unit>(3).bind(() => succeed("B"))

    var program = programA.inParallelWith(programB)
    for (let i = 0; i < 8; i++) {
      let result = unsafeRun(program, {})
      if (result.kind == "left") {
        program = result.value
      } else if (result.kind == "right") {
        let win = result.value.fst
  
        expect(win.fst).equal("A")
        expect(win.snd).equal("B")

        break
      }
    }
  });
});