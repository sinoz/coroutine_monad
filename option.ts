export type Option<A> = {
    kind: "some"
    value: A
} | {
    kind: "none"
}

export let Some = function<A>(value: A): Option<A> {
    return {
        kind: "some",
        value: value
    }
}

export let None = function<A>(): Option<A> {
    return {
        kind: "none"
    }
}

export let Option = <A>(value: A): Option<A> =>
    value == null ? None() : Some(value)