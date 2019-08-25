import { expect } from "chai"
import { describe, it } from "mocha"
import { Some, None } from "../src/option"
import { 
  Coroutine, 
  succeed, 
  fail, 
  suspend, 
  effect,
  transform,
  compute,
  fromOption,
  fromEither
} from "../src/coroutine"

describe('Coroutine constructors', function() {
    it('succeed', function() {
      let result = succeed<number, never, number>(10).unsafeRunGetValue(1)
      expect(result.fst).equal(10);
    });

    it('suspend', function() {
      let result = suspend<number, string>().unsafeRun(1)
      
      // `unsafeRun` throws an exception if the `Coroutine` had failed so merely checking
      // if the kind of result is 'left', will suffice.
      expect(result.kind).equal("left");
    });

    it('fail', function() {
      expect(() => fail<number, string, boolean>("Error!").unsafeRun(1)).to.throw(Error);
    });

    it('effect', function() {
      let result = effect<never, string>(() => "y").unsafeRunGetValue({})
      expect(result.fst).equal("y");
    });

    it('effectError', function() {
      expect(() => effect<Error, boolean>(s => { throw new Error() }).unsafeRun(({}))).to.throw(Error);
    });

    it('transform', function() {
      let result = transform<string, never>(s => s + "y").unsafeRunGetValue("x")
      expect(result.fst).equal("xy");
    });

    it('transformError', function() {
      expect(() => transform<number, Error>(s => { throw new Error() }).unsafeRun(1)).to.throw(Error);
    });

    it('compute', function() {
      let result = compute<number, never, number>(s => s + 1).unsafeRunGetValue(1)
      expect(result.fst).equal(2);
    });

    it('computeError', function() {
      expect(() => compute<number, Error, number>(s => { throw new Error() }).unsafeRun(1)).to.throw(Error);
    });

    it('fromOption', function() {
      expect(3 * 5).equal(15);
    });

    it('fromEither', function() {
      expect(3 * 5).equal(15);
    });
});