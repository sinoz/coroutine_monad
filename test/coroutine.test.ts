import { expect } from "chai"
import { describe, it } from "mocha"
import { Some, None } from "../src/option"
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

describe('Coroutine constructors', function () {
  it('succeed', function () {
    let result = succeed<number, never, number>(10).unsafeRunGetValue(1)
    expect(result.fst).equal(10);
  });

  it('suspend', function () {
    let result = suspend<number, string>().unsafeRun(1)

    // `unsafeRun` throws an exception if the `Coroutine` had failed so merely checking
    // if the kind of result is 'left', will suffice.
    expect(result.kind).equal("left");
  });

  it('fail', function () {
    expect(() => fail<number, string, boolean>("Error!").unsafeRun(1)).to.throw(Error);
  });

  it('effect', function () {
    let result = effect<never, string>(() => "y").unsafeRunGetValue({})
    expect(result.fst).equal("y");
  });

  it('effectError', function () {
    expect(() => effect<Error, boolean>(s => { throw new Error() }).unsafeRun(({}))).to.throw(Error);
  });

  it('transform', function () {
    let result = transform<string, never>(s => s + "y").unsafeRunGetValue("x")
    expect(result.fst).equal("xy");
  });

  it('transformError', function () {
    expect(() => transform<number, Error>(s => { throw new Error() }).unsafeRun(1)).to.throw(Error);
  });

  it('compute', function () {
    let result = compute<number, never, number>(s => s + 1).unsafeRunGetValue(1)
    expect(result.fst).equal(2);
  });

  it('computeError', function () {
    expect(() => compute<number, Error, number>(s => { throw new Error() }).unsafeRun(1)).to.throw(Error);
  });

  it('wait', function () {
    var program = wait(5)
    for (let i = 0; i < 5; i++) {
      let result = program.unsafeRun({})

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
      let result = program.unsafeRun({})
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

  it('fromOption', function () {
    expect(3 * 5).equal(15); // TODO
  });

  it('fromEither', function () {
    expect(3 * 5).equal(15); // TODO
  });
});

describe('Coroutine combinators', function () {
  it('repeat', function () {
    var numericVar = 0
    let repetition = effect<never, void>(() => { numericVar++ }).repeat(10)

    repetition.unsafeRun({})
    expect(numericVar).equal(10)
  });

  it('repeatUntil', function () {
    var numericVar = 0
    let repetition = effect<never, void>(() => { numericVar++ }).repeatUntil(() => numericVar >= 16)

    repetition.unsafeRun({})
    expect(numericVar).equal(16)
  });

  it('repeatWhile', function () {
    var numericVar = 0
    let repetition = effect<never, void>(() => { numericVar++ }).repeatWhile(() => numericVar <= 16)

    repetition.unsafeRun({})
    expect(numericVar).equal(17)
  });

  it('collectUntil', function () {
    let repetition = transform<number, never>(s => s + 1).collectUntil<number, never, number>(s => s >= 16)
    let result = repetition.unsafeRunGetValue(0)

    let allNumbers = result.fst.toArray()
    for (let i = 1; i <= 16; i++) {
      expect(allNumbers[i - 1]).equal(i)
    }
  });

  it('collectWhile', function () {
    let repetition = transform<number, never>(s => s + 1).collectWhile<number, never, number>(s => s <= 32)
    let result = repetition.unsafeRunGetValue(0)

    let allNumbers = result.fst.toArray()
    for (let i = 1; i <= 32; i++) {
      expect(allNumbers[i - 1]).equal(i)
    }
  });

  it('zip', function () {
    let programA = effect<string, number>(() => 64)
    let programB = effect<string, boolean>(() => true)
    let combined = programA.zip(programB)
    let result = combined.unsafeRunGetValue({})
    
    expect(result.fst.fst).equal(64)
    expect(result.fst.snd).equal(true)
  });

  it('raceAgainst', function () {
    let programA = wait(5).bind(() => succeed("A"))
    let programB = wait(3).bind(() => succeed("B"))

    var program = programA.raceAgainst(programB)
    for (let i = 0; i < 5; i++) {
      let result = program.unsafeRun({})
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
});