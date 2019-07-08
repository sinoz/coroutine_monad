export type Unit = {}

export interface Func<a, b> {
    f: (_: a) => b
    then: <c>(g: Func<b, c>) => Func<a, c>
}

export let id = <a>(): Func<a, a> => Func((x: a) => x)

export let Func = <a, b>(f: (_: a) => b): Func<a, b> => {
    return {
      f: f,
      then: function<c>(g: Func<b, c>): Func<a, c> {
        return Func<a, c>((x: a) => g.f(this.f(x)))
      }
    }
  }