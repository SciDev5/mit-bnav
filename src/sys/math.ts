import { assert_is_u24 } from "./assertion"
import { Vec2 } from "./structural/Vec2"

export function clamp(value: number, min: number, max: number) {
    return Math.max(min, Math.min(max, value))
}


const TWO_TO_THE_24TH = 1 << 24
export type U24PairUnordered = number
export function encode_u24_pair_unordered(a: number, b: number): U24PairUnordered {
    assert_is_u24(a, "encode_u24_pair_unordered.a")
    assert_is_u24(b, "encode_u24_pair_unordered.b")
    let x0 = Math.min(a, b)
    let x1 = Math.max(a, b)
    return x0 + (x1 * TWO_TO_THE_24TH)
}
export function decode_u24_pair(v: U24PairUnordered): [number, number] {
    return [
        v & 0xffffff,
        (v / TWO_TO_THE_24TH) & 0xffffff,
    ]
}

export function line_line_intersect_t_a(
    a0: Vec2,
    a1: Vec2,
    b0: Vec2,
    b1: Vec2,
): { t_a: number, t_b: number, p: Vec2 | null } {
    const t_a = (
        (a0.x - b0.x) * (b0.y - b1.y) - (a0.y - b0.y) * (b0.x - b1.x)
    ) / ((a0.x - a1.x) * (b0.y - b1.y) - (a0.y - a1.y) * (b0.x - b1.x))
    const t_b = (
        (b0.x - a0.x) * (a0.y - a1.y) - (b0.y - a0.y) * (a0.x - a1.x)
    ) / ((b0.x - b1.x) * (a0.y - a1.y) - (b0.y - b1.y) * (a0.x - a1.x))

    return {
        t_a,
        t_b,
        p: t_a >= 0 && t_a <= 1 && t_b >= 0 && t_b <= 1 ? a0.plus(a1.minus(a0).times_scalar(t_a)) : null,
    }
}
export function point_line_dist(
    a0: Vec2,
    a1: Vec2,
    p: Vec2,
): { t_a: number, p_line: Vec2, dist_sq: number } {
    const a01 = a1.minus(a0)
    const t_a = p.minus(a0).dot(a01) / a01.mag_sq()

    const p_line = a01.times_scalar(clamp(t_a, 0, 1)).plus(a0)

    return {
        t_a,
        p_line,
        dist_sq: p.dist_sq(p_line)
    }
}