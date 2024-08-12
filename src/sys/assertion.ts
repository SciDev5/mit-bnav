export function THROW(err?: any) {
    throw err
}

export function assert(condition: boolean, err: string = "assertion failed") {
    if (!condition) {
        throw err
    }
}


export function is_u16(v: number): true | false {
    return Number.isInteger(v) && v >= 0 && v < 0x1_0000
}
export function assert_is_u16(v: number, variable_name: string = "v") {
    assert(is_u16(v), `\`${variable_name}\` is not u16`)
}
export function is_u24(v: number): true | false {
    return Number.isInteger(v) && v >= 0 && v < 0x100_0000
}
export function assert_is_u24(v: number, variable_name: string = "v") {
    assert(is_u24(v), `\`${variable_name}\` is not u24`)
}