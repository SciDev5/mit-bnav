import { Rect2 } from "./Rect2"
import { Vec2, Vec2JSON } from "./Vec2"

function load_svg_elt(svg_src: string): SVGSVGElement | null {
    const contain = document.createElement("div")
    contain.innerHTML = svg_src
    const children = [...contain.children]
    if (children.length !== 1) {
        return null
    }
    const svg = children[0]
    if (svg instanceof SVGSVGElement) {
        return svg
    } else {
        return null
    }
}

function svg_elt_to_dpaths(svg: SVGElement): DPath[] {
    if (svg instanceof SVGGElement) {
        return svg_gelt_to_dpaths(svg)
    } else if (svg instanceof SVGPathElement) {
        return [svg_pathelt_to_dpaths(svg)]
    } else {
        return []
    }
}
function svg_gelt_to_dpaths(svg: SVGGElement): DPath[] {
    const paths = [...svg.children].flatMap(child_svg => child_svg instanceof SVGElement ? svg_elt_to_dpaths(child_svg) : [])

    const transform = svg.transform.baseVal.consolidate()?.matrix
    if (transform != null) {
        // if (!transform.is2D) console.warn("non 2d transform")
        if ((transform.a != 0 || transform.d != 0) && (transform.b != 0 || transform.c != 0)) console.warn("skew transform disallowed, skipped")
        const [flip_xy, scale] = (transform.a != 0 || transform.d != 0)
            ? [false, new Vec2(transform.a, transform.d)]
            : [true, new Vec2(transform.b, transform.c)]
        const offset = new Vec2(transform.e, transform.f)

        paths.forEach(path => {
            if (flip_xy) path.swap_xy()
            path.scale(scale)
            path.offset(offset)
        })
    }

    return paths
}
function svg_svgelt_to_dpaths(svg: SVGSVGElement): DPath[] {
    return [...svg.children].flatMap(child_svg => child_svg instanceof SVGElement ? svg_elt_to_dpaths(child_svg) : [])
}
function svg_pathelt_to_dpaths(svg: SVGPathElement): DPath {
    return DPath.parse(svg.getAttribute("d")!, { filled: svg.style.fill != "none" })
}

interface DCommand {
    relative: boolean
    scale(v: Vec2): void
    offset(v: Vec2): void
    swap_xy(): void
    stringify(): string
    as_vec(prev: Vec2): Vec2
}

enum AxisDirection {
    Horizontal,
    Vertical,
}
class DCommandAxisLine implements DCommand {
    constructor(
        public relative: boolean,
        public direction: AxisDirection,
        public x: number,
    ) { }
    scale(v: Vec2): void {
        switch (this.direction) {
            case AxisDirection.Horizontal:
                this.x *= v.x
                break
            case AxisDirection.Vertical:
                this.x *= v.y
                break
        }
    }
    offset(v: Vec2): void {
        switch (this.direction) {
            case AxisDirection.Horizontal:
                this.x += v.x
                break
            case AxisDirection.Vertical:
                this.x += v.y
                break
        }
    }
    swap_xy(): void {
        switch (this.direction) {
            case AxisDirection.Horizontal:
                this.direction = AxisDirection.Vertical
                break
            case AxisDirection.Vertical:
                this.direction = AxisDirection.Horizontal
                break
        }
    }
    stringify(): string {
        return `${(
            this.relative ?
                { [AxisDirection.Horizontal]: "h", [AxisDirection.Vertical]: "v" } :
                { [AxisDirection.Horizontal]: "H", [AxisDirection.Vertical]: "V" }
        )[this.direction]} ${this.x}`
    }
    as_vec(prev: Vec2): Vec2 {
        switch (this.direction) {
            case AxisDirection.Horizontal:
                return new Vec2(this.x, this.relative ? 0 : prev.y)
            case AxisDirection.Vertical:
                return new Vec2(this.relative ? 0 : prev.x, this.x)
        }
    }
}
class DCommandLine implements DCommand {
    constructor(
        public relative: boolean,
        public jump: boolean,
        public v: Vec2,
    ) { }
    scale(v: Vec2): void {
        this.v = this.v.times_components(v)
    }
    offset(v: Vec2): void {
        this.v = this.v.plus(v)
    }
    swap_xy(): void {
        this.v = new Vec2(this.v.y, this.v.x)
    }
    stringify(): string {
        return `${this.relative
            ? (this.jump ? "m" : "l")
            : (this.jump ? "M" : "L")} ${this.v.x} ${this.v.y}`
    }
    as_vec(prev: Vec2): Vec2 {
        return this.v
    }
}
class DCommandClose implements DCommand {
    constructor(
        public relative: boolean,
    ) { }
    scale(v: Vec2): void { }
    offset(v: Vec2): void { }
    swap_xy(): void { }
    stringify(): string {
        return this.relative ? "z" : "Z" // kinda irrelevant but ill keep it in for gits and shiggles
    }
    as_vec(_prev: Vec2): Vec2 {
        return new Vec2(0, 0)
    }
}

interface DPathStyle {
    filled?: boolean,
    // color: string,
    // secondary
}

class DPath {
    private constructor(
        public path: DCommand[],
        public style: DPathStyle,
        public id: string,
        public src: string,
    ) { }

    static parse(d: string, style: DPathStyle = {}, id: string = "-"): DPath {
        return new DPath([
            ...d.replaceAll(/,/g, " ").replaceAll(/\s+/g, " ").matchAll(/\s*([a-z])((?: -?\d+(?:\.\d*)?)*)|(.+?)/gi)
        ].flatMap(([v, cmd, args_str, match_fail]): DCommand[] => {
            if (match_fail) {
                console.warn(`DPath.parse match fail '${match_fail}'`);
                return []
            }
            let relative = false
            const args = args_str.trim().length > 0 ? args_str.trimStart().split(" ").map(v => parseFloat(v)) : []

            switch (cmd) {
                case "h": relative = true
                case "H":
                    return args.map(arg => new DCommandAxisLine(relative, AxisDirection.Horizontal, arg))
                case "v": relative = true
                case "V":
                    return args.map(arg => new DCommandAxisLine(relative, AxisDirection.Vertical, arg))
                case "m": relative = true
                case "M":
                    return new Array(Math.floor(args.length / 2)).fill(0).map((_, i) => new DCommandLine(relative, i === 0, new Vec2(args[2 * i], args[2 * i + 1])))
                // return [new DCommandLine(relative, true, new Vec2(args[0], args[1]))]
                case "l": relative = true
                case "L":
                    return new Array(Math.floor(args.length / 2)).fill(0).map((_, i) => new DCommandLine(relative, false, new Vec2(args[2 * i], args[2 * i + 1])))
                // return [new DCommandLine(relative, false, new Vec2(args[0], args[1]))]
                case "z": relative = true
                case "Z":
                    return [new DCommandClose(relative)]
            }
            console.warn(`DPath.parse unrecognized command '${cmd.toLowerCase}'`);
            return []
        }), style, id, d)
    }
    stringify(): string {
        // return this.path[0].stringify() + "h 1 v 1 h -1 v -1" + this.path.slice(1).map(cmd => cmd.stringify()).join(" ") + " h 1 v 1 h -1 v -1"
        return this.path.map(cmd => cmd.stringify()).join(" ")
    }

    scale(v: Vec2 | number) {
        const vv = v instanceof Vec2 ? v : new Vec2(v, v)
        for (const p of this.path) {
            p.scale(vv)
        }
        return this
    }
    offset(v: Vec2) {
        let is_first = true
        for (const p of this.path) {
            if (!p.relative || is_first) {
                p.offset(v)
            }
            is_first = false
        }
        return this
    }
    swap_xy() {
        for (const p of this.path) {
            p.swap_xy()
        }
    }
}

export class Path {
    constructor(
        public points: Vec2[],
        public loop: boolean,
        public filled: boolean,
        public src?: string,
        public id?: string,
    ) { }

    static load_paths(svg_src: string): Path[] | null {
        const svg = load_svg_elt(svg_src)
        if (svg == null) return null
        return svg_svgelt_to_dpaths(svg).flatMap(d_path => Path.from_d(d_path))
    }

    static parse_dstr(d_str: string, style?: DPathStyle, id?: string): Path[] {
        return Path.from_d(DPath.parse(d_str, style, id))
    }

    private static from_d(d: DPath): Path[] {
        let pos = new Vec2(0, 0)

        const paths: Path[] = []
        let building = null
        for (const s of d.path) {
            if ((s instanceof DCommandAxisLine) || (s instanceof DCommandLine)) {
                const v = s.as_vec(pos)
                const jump = (s instanceof DCommandLine) && s.jump
                if (jump) {
                    if (building != null) {
                        paths.push(building)
                    }
                    building = new Path([], false, d.style.filled ?? false, d.src, d.id)
                }
                pos = s.relative ? pos.plus(v) : v
                building ??= new Path([], false, d.style.filled ?? false, d.src, d.id)
                building.points.push(pos)
            }
            if (s instanceof DCommandClose) {
                building ??= new Path([], false, d.style.filled ?? false, d.src, d.id)
                building.loop = true
            }
        }
        if (building != null) {
            paths.push(building)
        }
        return paths
    }

    bounding_box(): Rect2 {
        const min = new Vec2(
            Math.min(...this.points.map(v => v.x)),
            Math.min(...this.points.map(v => v.y)),
        )
        const max = new Vec2(
            Math.max(...this.points.map(v => v.x)),
            Math.max(...this.points.map(v => v.y)),
        )
        return new Rect2(
            min,
            max.minus(min)
        )
    }
    rotated(rotor: Vec2): Path {
        return new Path(
            this.points.map(point => point.cx_times(rotor)),
            this.loop,
            this.filled,
        )
    }
    flipped_xy(): Path {
        return new Path(
            this.points.map(({ x, y }) => new Vec2(y, x)),
            this.loop,
            this.filled,
        )
    }
    normalized(): Path {
        const bb = this.bounding_box()
        const scale = 1 / Math.max(bb.dim.x, bb.dim.y, 1e-100)
        return new Path(
            this.points.map(v => v.minus(bb.pos).times_scalar(scale)),
            this.loop,
            this.filled,
        )
    }
    normalized_unrotated(): { path: Path, restorative_rot: Vec2 } {
        const mean_pos = this.points.reduce((a, b) => a.plus(b)).times_scalar(1 / this.points.length)
        const restorative_rot = this.points[0].minus(mean_pos).normalized()

        const unrotated = this.rotated(restorative_rot.cx_conj())

        const bb = unrotated.bounding_box()
        const scale = 1 / Math.max(bb.dim.x, bb.dim.y, 1e-100)
        return {
            path: new Path(
                unrotated.points.map(v => v.minus(bb.pos).times_scalar(scale)),
                this.loop,
                this.filled,
            ),
            restorative_rot,
        }
    }
    static conormalize(paths: Path[]) {
        if (paths.length === 0) {
            return []
        }
        const bb = paths.map(p => p.bounding_box()).reduce((a, b) => a.merge(b))
        const scale = 1 / Math.max(bb.dim.x, bb.dim.y, 1e-100)
        return paths.map(p => new Path(
            p.points.map(v => v.minus(bb.pos).times_scalar(scale)),
            p.loop,
            p.filled,
        ))
    }
    dist_to_point(v: Vec2) {
        return Math.min(...
            new Array(this.points.length - 1).fill(0)
                .map((_, i) => v.dist_to_segment_sq(this.points[i], this.points[i + 1]))
        )
    }
    static _dist_one_way_many(a: Path[], b: Path[]): number {
        return Math.min(...b.flatMap(b => a.flatMap(a => a.points.map(a => b.dist_to_point(a)))))
    }
    static _dist_one_way(a: Path, b: Path): number {
        return Math.min(...a.points.map(a => b.dist_to_point(a)))
    }
    direct_compare(template: Path, thresh = 0.01): boolean {
        if (this.points.length !== template.points.length) {
            return false
        }
        return this.points.every((point, i) => point.minus(template.points[i]).mag_sq() <= thresh * thresh)

        // const r = [
        //     ...template.points.map(point => Math.min(...this.points.map(p => point.minus(p).mag_sq()))),
        //     ...this.points.map(point => Math.min(...template.points.map(p => point.minus(p).mag_sq()))),
        // ].sort((a, b) => b - a)
        // return r[1] <= thresh * thresh

        // return Math.max(APath._dist_one_way(this, template), APath._dist_one_way(template, this)) <= thresh * thresh
    }
    // static direct_compare_many(a: APath[], b: APath[], thresh = 0.01): boolean {
    //     return Math.max(APath._dist_one_way_many(a, b), APath._dist_one_way_many(b, a)) <= thresh * thresh
    // }

    stringify(scale: number): string {
        return "M " +
            this.points
                .map(({ x, y }) => `${x * scale} ${y * scale}`)
                .join(" L ") +
            (this.loop ? " z" : "")
    }

    to_json(): PathJSON {
        return {
            points: this.points.map(v => v.to_json()),
            loop: this.loop,
            ...this.filled && { filled: true },
        }
    }
    static from_json(json: PathJSON): Path {
        return new Path(
            json.points.map(Vec2.from_json),
            json.loop,
            json.filled ?? false,
        )
    }
}

export interface PathJSON {
    points: Vec2JSON[],
    loop: boolean,
    filled?: boolean,
}