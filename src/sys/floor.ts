import { Vec2 } from "./structural/Vec2"

export class Floor {
    constructor(
        readonly points: Vec2[],
        readonly doors: Door[],
        readonly rooms: Room[],
    ) {
    }
}

export class Door {
    constructor(
        readonly path: number[],
        readonly rooms: [number, number],
    ) { }
}

export class Room {
    constructor(
        readonly path: number[],
        readonly path_negatives: number[][],
        readonly doors: Door[]
    ) {
        this.fix()
    }


    fix() {
        for (let i = this.path.length - 2; i >= 0; i--) {
            if (this.path[i + 1] === this.path[i]) {
                this.path.splice(i, 1)
            }
        }
        for (let i = this.path.length - 3; i >= 0; i--) {
            if (this.path[i + 2] === this.path[i]) {
                this.path.splice(i, 2)
            }
        }
        for (let i = this.path.length; i >= 1; i--) {
            for (let j = 0; j < i; j++) {
                if (this.path[i] === this.path[j]) {
                    this.path.splice(i, 1)
                    break
                }
            }
        }
    }

    copy() {
        return new Room([...this.path], this.path_negatives.map(v => [...v]), [...this.doors])
    }

    join(other: Room): boolean {
        if (!this.join_path_in([...other.path])) return false
        this.path_negatives.push(...other.path_negatives)
        console.warn("TODO: doors");
        return true
    }
    private join_path_in(part: number[]): boolean {
        part.reverse()
        const shared = this.shared_points(part)

        if (shared == null) return false
        const s = this.path[shared.self_i]
        this.cut(this.path[shared.self_i], this.path[(shared.self_i + shared.n - 1) % this.path.length])

        this.path.splice(
            (this.path.indexOf(s) + 1) % this.path.length,
            0,
            ...circular_slice(part.reverse(), part.indexOf(s), part.length - shared.n + 1),
        )

        this.fix()

        return true
    }

    shared_points(part: number[]): { self_i: number, n: number, part_i: number } | null {
        let was_shared = part.includes(this.path[0])
        let first = was_shared ? 0 : -1
        for (let i = 1; i < this.path.length; i++) {
            const is_shared = part.includes(this.path[i])
            if (!was_shared && is_shared) {
                first = i
                break
            }
            was_shared = is_shared
        }
        if (first === -1) return null

        let self_i = first
        let part_i = part.indexOf(this.path[first])
        let n = 1
        for (let ioff = 1; ioff < this.path.length; ioff++) {
            const is_shared = this.path[(self_i + ioff) % this.path.length] === part[(part_i + ioff) % part.length]
            if (!is_shared) {
                break
            }
            n += 1
        }
        if (n > part.length) return null

        console.log(
            "J,i;",
            self_i, part_i, n,
            circular_slice(this.path, self_i, n),
            circular_slice(part, part_i, n),
            circular_slice(this.path, self_i + n, this.path.length - n),
            circular_slice(part, part_i + n, part.length - n),
        );


        if (new Set(circular_slice(this.path, self_i + n, this.path.length - n))
            .intersection(new Set(circular_slice(part, self_i + n, part.length - n)))
            .size > 0
        ) return null

        return { self_i, part_i, n }
    }

    cut(a: number, b: number) {
        this.fix()
        const ia = this.path.findIndex(v => v === a)
        const ib = this.path.findIndex(v => v === b)
        console.log(ia, ib);

        if (ia === -1 || ib === -1 || ia === ib || ib === (ia + 1) % this.path.length) return
        if (ib > ia) {
            this.path.splice(ia + 1, ib - ia - 1)
        } else {
            this.path.splice(ia + 1)
            this.path.splice(0, ib)
        }
    }
}

const circular_slice = (a: number[], i: number, n: number) => (i + n <= a.length)
    ? a.slice(i, i + n)
    : [...a.slice(i, a.length), ...a.slice(0, i + n - a.length)]
