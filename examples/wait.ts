import { Coroutine, transform, putStrLn, wait } from "../src/coroutine"
import { unsafeRunGetValue, unsafeRun } from "../src/runtime"
import { Unit } from "../src/func"

var program = wait<number>(1).bind(() => transform<number, Unit>(s => s * 2))

var interval = setInterval(() => {
    let result = unsafeRun(program, 1)
    if (result.kind == "left") {
        console.log("Suspended!")
        program = result.value
    } else {
        console.log("Got a result! " + result.value.fst)
        clearInterval(interval)
    }
}, 250);