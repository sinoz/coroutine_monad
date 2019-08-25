export type Unit = {}

export interface Func<a, b> {
    invoke: (_: a) => b
    andThen: <c>(g: Func<b, c>) => Func<a, c>
}

export let identity = <a>(): Func<a, a> => Func((x: a) => x)

export let Func = <a, b>(f: (_: a) => b): Func<a, b> => {
    return {
      invoke: f,
      andThen: function<c>(g: Func<b, c>): Func<a, c> {
        return Func<a, c>((x: a) => g.invoke(f(x)))
      }
    }
  }