import { Vec2 } from "./Vec2"

export class Rect2 {
    readonly pos: Vec2
    readonly dim: Vec2
    constructor(
        pos: Vec2,
        dim: Vec2,
    ) {
        this.pos = pos.copy()
        this.dim = dim.copy()
    }
    merge(rhs: Rect2) {
        const min = new Vec2(
            Math.min(this.x_min, rhs.x_min),
            Math.min(this.y_min, rhs.y_min),
        )
        const max = new Vec2(
            Math.max(this.x_max, rhs.x_max),
            Math.max(this.y_max, rhs.y_max),
        )
        return new Rect2(
            min,
            max.minus(min)
        )
    }
    get x_min() { return this.pos.x }
    set x_min(x) { this.pos.x = x }
    get y_min() { return this.pos.y }
    set y_min(y) { this.pos.y = y }
    get x_max() { return this.pos.x + this.dim.x }
    set x_max(x) { this.dim.x = x - this.pos.x }
    get y_max() { return this.pos.y + this.dim.y }
    set y_max(y) { this.dim.y = y - this.pos.y }
    get x() { return this.pos.x }
    set x(x) { this.pos.x = x }
    get y() { return this.pos.y }
    set y(y) { this.pos.y = y }
    get w() { return this.dim.x }
    set w(w) { this.dim.x = w }
    get h() { return this.dim.y }
    set h(h) { this.dim.y = h }

    area(): number {
        return this.w * this.h
    }


    to_json(): Rect2JSON {
        return [this.x, this.y, this.w, this.h]
    }
    static from_json([x, y, w, h]: Rect2JSON): Rect2 {
        return new Rect2(new Vec2(x, y), new Vec2(w, h))
    }
    static from_points(...points: Vec2[]): Rect2 {
        const x_min = Math.min(...points.map(v => v.x))
        const x_max = Math.max(...points.map(v => v.x))
        const y_min = Math.min(...points.map(v => v.y))
        const y_max = Math.max(...points.map(v => v.y))
        return new Rect2(
            new Vec2(x_min, y_min),
            new Vec2(x_max - x_min, y_max - y_min),
        )
    }
    intersects(other: Rect2): boolean {
        return (this.x_min <= other.x_max && this.x_max >= other.x_min) && (this.y_min <= other.y_max && this.y_max >= other.y_min)
    }
}

export type Rect2JSON = [number, number, number, number]