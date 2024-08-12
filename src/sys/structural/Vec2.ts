export class Vec2 {
    constructor(
        public x: number,
        public y: number,
    ) { }
    plus(rhs: Vec2) {
        return new Vec2(this.x + rhs.x, this.y + rhs.y)
    }
    minus(rhs: Vec2) {
        return new Vec2(this.x - rhs.x, this.y - rhs.y)
    }
    times_components(rhs: Vec2) {
        return new Vec2(this.x * rhs.x, this.y * rhs.y)
    }
    times_scalar(rhs: number) {
        return new Vec2(this.x * rhs, this.y * rhs)
    }
    mag_sq() {
        return this.x * this.x + this.y * this.y
    }
    dist_sq(rhs: Vec2) {
        return this.minus(rhs).mag_sq()
    }
    dist_to_segment_sq(p0: Vec2, p1: Vec2) {
        let t = ((this.x - p0.x) * (p1.x - p0.x) + (this.y - p0.y) * (p1.y - p0.y)) / p0.dist_sq(p1);
        t = Math.max(0, Math.min(1, t));
        return this.dist_sq(new Vec2(p0.x + t * (p1.x - p0.x), p0.y + t * (p1.y - p0.y)));
    }
    copy() {
        return new Vec2(this.x, this.y)
    }
    normalized() {
        return this.times_scalar(1 / Math.sqrt(this.mag_sq()))
    }
    cx_times(rhs: Vec2) {
        return new Vec2(
            this.x * rhs.x - this.y * rhs.y,
            this.x * rhs.y + this.y * rhs.x,
        )
    }
    cx_conj() {
        return new Vec2(this.x, -this.y)
    }

    to_json(): Vec2JSON {
        return [this.x, this.y]
    }
    static from_json([x, y]: Vec2JSON): Vec2 {
        return new Vec2(x, y)
    }

    dot(rhs: Vec2): number {
        return this.x * rhs.x + this.y * rhs.y
    }
}

export type Vec2JSON = [number, number]