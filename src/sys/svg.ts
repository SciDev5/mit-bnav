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

}
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
}

export class Path {
    constructor(
        public points: Vec2[],
        public loop: boolean,
        public filled: boolean,
        public src?: string,
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
                    building = new Path([], false, d.style.filled ?? false, d.src)
                }
                pos = s.relative ? pos.plus(v) : v
                building ??= new Path([], false, d.style.filled ?? false, d.src)
                building.points.push(pos)
            }
            if (s instanceof DCommandClose) {
                building ??= new Path([], false, d.style.filled ?? false, d.src)
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
}

enum RequireNearbyLevel {
    None,
    Weak,
    Strong,
}
type FontSymbolInfo = { needs_others_nearby: number, h_rel: number, y_off: number }
type FontMatchedSymbol = { ch: string, bb: Rect2, bb_line: Rect2, i: number, n: number }
type FontMatchedSymbolRotated = FontMatchedSymbol & { restorative_rot: Vec2 }

export class Font {
    readonly map: Map<Path[], string>
    readonly symbol_infos: Map<string, FontSymbolInfo>
    readonly check_order: {
        conormalized: Path[], individual: Path[],
        conormalized_rot: Path[], individual_rot: Path[],
    }[]
    constructor(
        readonly max_size: number,
        map_in: Record<string, { paths: Path[][], info: FontSymbolInfo }>,
    ) {
        this.map = new Map(Object.entries(map_in).flatMap(([char, { paths }]) => paths.map(paths => [Path.conormalize(paths), char])))
        this.symbol_infos = new Map(Object.entries(map_in).map(([char, { info }]) => [char, info]))
        this.check_order = [...this.map.keys()].sort((a, b) => b.length - a.length).map(v => {
            const rotation = v[0].normalized_unrotated().restorative_rot.cx_conj()
            return {
                conormalized: v,
                individual: v.map(v => v.normalized()),
                conormalized_rot: Path.conormalize(v.map(v => v.rotated(rotation))),
                individual_rot: v.map(v => v.rotated(rotation).normalized()),
            }
        })
    }

    find_symbols(s: Path[], thresh = 0.01): FontMatchedSymbol[] {
        const letters: FontMatchedSymbol[] = []
        const s_norm_ind = s.map(v => v.normalized())

        for (let i = 0; i < s.length; i++) {
            const n_max = s.length - i
            for (const { conormalized: t_norm_co, individual: t_norm_ind } of this.check_order) {
                const n = t_norm_co.length
                if (n > n_max) continue
                if (!s_norm_ind[i].direct_compare(t_norm_ind[0], thresh)) continue
                const s_norm_co = Path.conormalize(s.slice(i, i + n))
                if (!s_norm_co.every((_, j) => s_norm_co[j].direct_compare(t_norm_co[j], thresh))) continue
                // if (!APath.direct_compare_many(s_norm_co, t_norm_co, thresh)) continue

                const ch = this.map.get(t_norm_co)!
                const ch_info = this.symbol_infos.get(ch)!
                const bb = s.slice(i, i + n).map(s => s.bounding_box()).reduce((a, b) => a.merge(b))
                const h = bb.h / ch_info.h_rel
                const bb_line = new Rect2(new Vec2(bb.x, bb.y + h * ch_info.y_off), new Vec2(bb.h, h))

                letters.push({ ch, bb, bb_line, i, n })
                i += n - 1
                break
            }
        }

        return letters
    }

    find_symbols_rotated(s: Path[], thresh = 0.01): FontMatchedSymbolRotated[] {
        const letters: FontMatchedSymbolRotated[] = []
        const s_norm_ind = s.map(v => v.normalized_unrotated())

        for (let i = 0; i < s.length; i++) {
            const n_max = s.length - i
            for (const { conormalized: t_norm_co, individual: t_norm_ind } of this.check_order) {
                const n = t_norm_co.length
                if (n > n_max) continue
                if (!s_norm_ind[i].path.direct_compare(t_norm_ind[0], thresh)) continue
                const { restorative_rot } = s_norm_ind[i]
                const s_norm_co = Path.conormalize(s.slice(i, i + n).map(v => v.rotated(restorative_rot.cx_conj())))
                if (!s_norm_co.every((_, j) => s_norm_co[j].direct_compare(t_norm_co[j], thresh))) continue
                // if (!APath.direct_compare_many(s_norm_co, t_norm_co, thresh)) continue

                const ch = this.map.get(t_norm_co)!
                const ch_info = this.symbol_infos.get(ch)!
                const bb = s.slice(i, i + n).map(s => s.bounding_box()).reduce((a, b) => a.merge(b))
                const h = bb.h / ch_info.h_rel
                const bb_line = new Rect2(new Vec2(bb.x, bb.y + h * ch_info.y_off), new Vec2(bb.h, h))

                letters.push({ ch, bb, bb_line, i, n, restorative_rot })
                i += n - 1
                break
            }
        }

        return letters
    }

    wordify(letters_in: FontMatchedSymbol[], thresh: number = 0.01): { str: FontMatchedSymbol[], bb: Rect2 }[] {
        const letters = letters_in.map(l => l).sort((a, b) => a.bb.x - b.bb.x)
        const words: { str: FontMatchedSymbol[], bb: Rect2 }[] = []

        for (let i = 0; i < letters.length; i++) {
            const word = { str: [letters[i]], bb: letters[i].bb_line }

            for (let j = i + 1; j < letters.length && letters[j].bb_line.x_min < word.bb.x_max + word.bb.h * 0.5; j++) {
                const letter = letters[j]

                if (Math.abs((letter.bb_line.y - word.bb.y) / word.bb.h) > thresh) continue
                if (Math.abs((letter.bb_line.h - word.bb.h) / word.bb.h) > thresh) continue

                word.str.push(letter)
                word.bb.x_max = letter.bb_line.x_max
                letters.splice(j, 1)
                j--
            }

            if (word.str.length === 1 && this.symbol_infos.get(word.str[0].ch)!.needs_others_nearby === RequireNearbyLevel.Weak) {
                continue
            }
            if (word.str.every(({ ch }) => this.symbol_infos.get(ch)!.needs_others_nearby === RequireNearbyLevel.Strong)) {
                continue
            }

            words.push(word)
        }

        const heights = words.map(v => v.bb.h).sort((a, b) => a - b)
        const median_height = heights[Math.floor(heights.length / 2)]

        return words.filter(word => Math.abs(1 - word.bb.h / median_height) < 0.5)
    }

    static from_cfg(max_size: number, map_in: Record<string, [Partial<FontSymbolInfo>, ...Array<Array<[Array<[number, number]>, boolean]>>]>): Font {
        return new Font(
            max_size,
            Object.fromEntries(
                Object.entries(map_in)
                    .map(([ch, [info_partial, ...v]]) => (
                        [
                            ch,
                            {
                                paths: v.map(v => v.map(([p, loop]) => new Path(p.map(([x, y]) => new Vec2(x, y)), loop, false))),
                                info: { needs_others_nearby: info_partial.needs_others_nearby ?? 0, h_rel: info_partial.h_rel ?? 1, y_off: info_partial.y_off ?? 0 }
                            },
                        ]
                    ))
            )
        )
    }
    static readonly DEFAULT = Font.from_cfg(4, {
        "0": [
            {},
            [[[[0.29032258064517286, 0], [0.12903225806452737, 0.03225806451612726], [0.03225806451613643, 0.19354838709677272], [0, 0.4193548387096727], [0, 0.548387096774191], [0.03225806451613643, 0.8064516129032273], [0.12903225806452737, 0.9354838709677455], [0.29032258064517286, 1], [0.38709677419356375, 1], [0.5161290322580728, 0.9354838709677455], [0.6129032258064637, 0.8064516129032273], [0.6774193548387183, 0.548387096774191], [0.6774193548387183, 0.4193548387096727], [0.6129032258064637, 0.19354838709677272], [0.5161290322580728, 0.03225806451612726], [0.38709677419356375, 0]], true]],
        ],
        "1": [
            {},
            [[[[0, 0.19354838709677272], [0.09677419354839094, 0.1290322580645182], [0.2580645161290364, 0], [0.2580645161290364, 1]], false]],
        ],
        "2": [
            {},
            [[[[0.0322580645161178, 0.25806451612902487], [0.0322580645161178, 0.19354838709677097], [0.09677419354837173, 0.09677419354838089], [0.12903225806450785, 0.06451612903225393], [0.22580645161289792, 0], [0.41935483870967805, 0], [0.516129032258068, 0.06451612903225393], [0.5806451612903221, 0.09677419354838089], [0.6129032258064582, 0.19354838709677097], [0.6129032258064582, 0.29032258064516103], [0.5806451612903221, 0.3870967741935511], [0.48387096774193195, 0.516129032258068], [0, 1], [0.645161290322576, 1]], false]],
        ],
        "3": [
            {},
            [[[[0.09374999999996836, 0], [0.5937499999999772, 0], [0.31249999999998335, 0.3749999999999978], [0.4687499999999839, 0.3749999999999978], [0.5624999999999878, 0.43749999999999445], [0.593749999999995, 0.46875000000000167], [0.6562499999999917, 0.6250000000000022], [0.6562499999999917, 0.7187500000000061], [0.593749999999995, 0.8437499999999994], [0.4999999999999911, 0.9375000000000033], [0.3749999999999978, 1], [0.21874999999999722, 1], [0.09375000000000389, 0.9375000000000033], [0.031250000000007216, 0.9062499999999961], [0, 0.8124999999999922]], false]],
        ],
        "4": [
            {},
            [[[[0.48387096774193195, 0], [0, 0.6774193548387121], [0.7096774193548299, 0.6774193548387121]], false], [[[0.48387096774193195, 0], [0.48387096774193195, 1]], false]],
        ],
        "5": [
            {},
            [[[[0.5483870967741808, 0], [0.09677419354838916, 0], [0.03225806451613583, 0.41935483870967416], [0.09677419354838916, 0.3870967741935475], [0.2258064516128958, 0.32258064516129414], [0.3548387096774025, 0.32258064516129414], [0.516129032258045, 0.3870967741935475], [0.6129032258064341, 0.48387096774193666], [0.64516129032257, 0.6129032258064525], [0.64516129032257, 0.7096774193548416], [0.6129032258064341, 0.8387096774193574], [0.516129032258045, 0.9354838709677467], [0.3548387096774025, 1], [0.2258064516128958, 1], [0.09677419354838916, 0.9354838709677467], [0.03225806451613583, 0.90322580645162], [0, 0.8064516129032308]], false]],
        ],
        "6": [
            {},
            [[[[0.5624999999999867, 0.18750000000000444], [0.4999999999999911, 0.06250000000001332], [0.3749999999999911, 0], [0.24999999999999112, 0], [0.12499999999999112, 0.06250000000001332], [0.06249999999999556, 0.18750000000000444], [0, 0.4374999999999867], [0, 0.6874999999999689], [0.06249999999999556, 0.8749999999999734], [0.12499999999999112, 0.9374999999999867], [0.24999999999999112, 1], [0.3124999999999867, 1], [0.4374999999999867, 0.9374999999999867], [0.5624999999999867, 0.8749999999999734], [0.5624999999999867, 0.7499999999999822], [0.5624999999999867, 0.6874999999999689], [0.5624999999999867, 0.5624999999999778], [0.4374999999999867, 0.4374999999999867], [0.3124999999999867, 0.37499999999997335], [0.24999999999999112, 0.37499999999997335], [0.12499999999999112, 0.4374999999999867], [0.06249999999999556, 0.5624999999999778], [0, 0.6874999999999689]], false]],
        ],
        "7": [
            {},
            [[[[0.19354838709678188, 1], [0.6451612903225818, 0], [0, 0]], false]],
        ],
        "8": [
            {},
            [[[[0.22580645161289375, 0], [0.09677419354838827, 0.03225806451613554], [0.03225806451613554, 0.1290322580645238], [0.03225806451613554, 0.2258064516129121], [0.09677419354838827, 0.32258064516130036], [0.19354838709677655, 0.3870967741935531], [0.3870967741935531, 0.41935483870968865], [0.5161290322580586, 0.4838709677419414], [0.6129032258064468, 0.5806451612903297], [0.6774193548386996, 0.677419354838718], [0.6774193548386996, 0.8064516129032234], [0.6129032258064468, 0.9032258064516118], [0.5806451612903113, 0.9677419354838644], [0.41935483870967033, 1], [0.22580645161289375, 1], [0.09677419354838827, 0.9677419354838644], [0.03225806451613554, 0.9032258064516118], [0, 0.8064516129032234], [0, 0.677419354838718], [0.03225806451613554, 0.5806451612903297], [0.1290322580645238, 0.4838709677419414], [0.29032258064516486, 0.41935483870968865], [0.4838709677419414, 0.3870967741935531], [0.5806451612903297, 0.32258064516130036], [0.6129032258064652, 0.2258064516129121], [0.6129032258064652, 0.1290322580645238], [0.5806451612903297, 0.03225806451613554], [0.41935483870968865, 0]], true]],
        ],
        "9": [
            {},
            [[[[0.6129032258064582, 0.3548387096774058], [0.5806451612903221, 0.4838709677419136], [0.48387096774193195, 0.5806451612903037], [0.322580645161288, 0.6451612903225576], [0.2903225806451519, 0.6451612903225576], [0.161290322580644, 0.5806451612903037], [0.06451612903225393, 0.4838709677419136], [0, 0.3548387096774058], [0, 0.2903225806451519], [0.06451612903225393, 0.161290322580644], [0.161290322580644, 0.06451612903225393], [0.2903225806451519, 0], [0.322580645161288, 0], [0.48387096774193195, 0.06451612903225393], [0.5806451612903221, 0.161290322580644], [0.6129032258064582, 0.3548387096774241], [0.6129032258064582, 0.5806451612903221], [0.5806451612903221, 0.80645161290322], [0.48387096774193195, 0.9677419354838639], [0.322580645161288, 1], [0.22580645161289792, 1], [0.09677419354839006, 0.9677419354838639], [0.06451612903225393, 0.8709677419354739]], false]],
        ],

        "a": [
            {},
            [[[[0, 1], [0.35483870967742737, 0], [0.7419354838709912, 1]], false], [[[0.1290322580645457, 0.6774193548387091], [0.612903225806482, 0.6774193548387091]], false]],
        ],
        "b": [
            {},
            [[[[1.8336586729292775e-14, 0.9999999999999909], [1.8336586729292775e-14, 0], [0.41935483870969636, 0], [0.5483870967742043, 0.032258064516126964], [0.6129032258064582, 0.09677419354838089], [0.6451612903225943, 0.19354838709677097], [0.6451612903225943, 0.29032258064516103], [0.6129032258064582, 0.3870967741935511], [0.5483870967742043, 0.41935483870967805], [0.41935483870969636, 0.48387096774193195], [1.8336586729292775e-14, 0.48387096774193195]], false], [[[0.41935483870967805, 0.48387096774194116], [0.548387096774186, 0.516129032258068], [0.6129032258064399, 0.5806451612903221], [0.645161290322576, 0.6774193548387121], [0.645161290322576, 0.8064516129032291], [0.6129032258064399, 0.9032258064516192], [0.548387096774186, 0.9677419354838731], [0.41935483870967805, 1], [0, 1]], false]],
        ],
        "c": [
            {},
            [[[[0.7187500000000111, 0.25], [0.6562500000000155, 0.15624999999999778], [0.5625000000000133, 0.06249999999999556], [0.4687500000000111, 0], [0.28125000000000666, 0], [0.18750000000000444, 0.06249999999999556], [0.09375000000000222, 0.15624999999999778], [0.06249999999999556, 0.25], [0, 0.375], [0, 0.625], [0.06249999999999556, 0.75], [0.09375000000000222, 0.8437500000000022], [0.18750000000000444, 0.9375000000000044], [0.28125000000000666, 1], [0.4687500000000111, 1], [0.5625000000000133, 0.9375000000000044], [0.6562500000000155, 0.8437500000000022], [0.7187500000000111, 0.75]], false]],
        ],
        "d": [
            {},
            [[[[0, 1], [0, 0], [0.322580645161288, 0], [0.45161290322579584, 0.06451612903225393], [0.548387096774186, 0.161290322580644], [0.6129032258064399, 0.22580645161289792], [0.645161290322576, 0.38709677419354194], [0.645161290322576, 0.6129032258064399], [0.6129032258064399, 0.7741935483870839], [0.548387096774186, 0.8709677419354739], [0.45161290322579584, 0.9677419354838639], [0.322580645161288, 1]], true]],
        ],
        "e": [
            { needs_others_nearby: RequireNearbyLevel.Weak },
            [[[[0, 1], [0, 0], [0.6129032258064399, 0]], false], [[[0, 0.48387096774193195], [0.3548387096774241, 0.48387096774193195]], false], [[[0, 1], [0.6129032258064399, 1]], false]],
        ],
        "f": [
            { needs_others_nearby: RequireNearbyLevel.Weak },
            [[[[0, 1], [0, 0], [0.6129032258064399, 0]], false], [[[0, 0.48387096774193195], [0.3548387096774241, 0.48387096774193195]], false]],
        ],
        "g": [
            {},
            [[[[0.7096774193548115, 0.258064516129034], [0.6451612903225393, 0.161290322580644], [0.5483870967741675, 0.06451612903225393], [0.45161290322579584, 0], [0.2580645161290157, 0], [0.161290322580644, 0.06451612903225393], [0.06451612903227226, 0.161290322580644], [0.03225806451613613, 0.258064516129034], [0, 0.38709677419354194], [0, 0.645161290322576], [0.03225806451613613, 0.7741935483870839], [0.06451612903227226, 0.8709677419354739], [0.161290322580644, 0.9677419354838639], [0.2580645161290157, 1], [0.45161290322579584, 1], [0.5483870967741675, 0.9677419354838639], [0.6451612903225393, 0.8709677419354739], [0.7096774193548115, 0.7741935483870839], [0.7096774193548115, 0.645161290322576], [0.45161290322579584, 0.645161290322576]], false]],
        ],
        "h": [
            {},
            [[[[0, 0], [0, 1]], false], [[[0.645161290322576, 0], [0.645161290322576, 1]], false], [[[0, 0.48387096774193195], [0.645161290322576, 0.48387096774193195]], false]],
        ],
        "i": [
            { needs_others_nearby: RequireNearbyLevel.Strong },
            [[[[0, 0], [0, 1]], false]],
        ],
        "j": [
            {},
            [[[[0.4838709677419547, 0], [0.4838709677419547, 0.7419354838709727], [0.4193548387097002, 0.9032258064516182], [0.38709677419356375, 0.9354838709677455], [0.29032258064517286, 1], [0.19354838709678188, 1], [0.09677419354839094, 0.9354838709677455], [0.06451612903225452, 0.9032258064516182], [0, 0.7419354838709727], [0, 0.6451612903225818]], false]],
        ],

        "l": [
            { needs_others_nearby: RequireNearbyLevel.Weak },
            [[[[0, 0], [0, 1], [0.5625000000000056, 1]], false]],
        ],
        "m": [
            {},
            [[[[0, 1], [0, 0], [0.38709677419354194, 1], [0.7741935483870839, 0], [0.7741935483870839, 1]], false]],
        ],
        "n": [
            {},
            [[[[0, 1], [0, 0], [0.6774193548387183, 1], [0.6774193548387183, 0]], false]],
        ],
        "o": [
            {},
            [[[[0.2903225806451702, 0], [0.19354838709678013, 0.06451612903225393], [0.09677419354839006, 0.161290322580644], [0.06451612903225393, 0.258064516129034], [0, 0.38709677419354194], [0, 0.6129032258064399], [0.06451612903225393, 0.7741935483870839], [0.09677419354839006, 0.8709677419354739], [0.19354838709678013, 0.9677419354838639], [0.2903225806451702, 1], [0.4838709677419503, 1], [0.5806451612903404, 0.9677419354838639], [0.6774193548387304, 0.8709677419354739], [0.7419354838709844, 0.7741935483870839], [0.7741935483871205, 0.6129032258064399], [0.7741935483871205, 0.38709677419354194], [0.7419354838709844, 0.258064516129034], [0.6774193548387304, 0.161290322580644], [0.5806451612903404, 0.06451612903225393], [0.4838709677419503, 0]], true]],
        ],
        "p": [
            {},
            [[[[0, 1], [0, 0], [0.41935483870967805, 0], [0.5806451612903221, 0.03225806451613613], [0.6129032258064582, 0.09677419354839006], [0.6774193548387121, 0.19354838709678013], [0.6774193548387121, 0.322580645161288], [0.6129032258064582, 0.41935483870967805], [0.5806451612903221, 0.48387096774193195], [0.41935483870967805, 0.516129032258068], [0, 0.516129032258068]], false]],
        ],

        "r": [
            {},
            [[[[0, 1], [0, 0], [0.45161290322579994, 0], [0.580645161290309, 0.03225806451612726], [0.6129032258064454, 0.09677419354838178], [0.6774193548387, 0.19354838709677272], [0.6774193548387, 0.29032258064516364], [0.6129032258064454, 0.3870967741935546], [0.580645161290309, 0.4193548387096819], [0.45161290322579994, 0.4838709677419364], [0, 0.4838709677419364]], false], [[[0.35483870967742737, 0.4838709677419272], [0.6774193548387183, 0.9999999999999909]], false]],
        ],
        "s": [
            {},
            [[[[0.6249999999999967, 0.15624999999999917], [0.5312499999999937, 0.062499999999996114], [0.4062500000000014, 0], [0.21874999999999528, 0], [0.09375000000000305, 0.062499999999996114], [0, 0.15624999999999917], [0, 0.2500000000000022], [0.03125000000000694, 0.3437500000000053], [0.09375000000000305, 0.37500000000000333], [0.1875000000000061, 0.43749999999999944], [0.4375000000000083, 0.5312500000000024], [0.5312500000000113, 0.5625000000000006], [0.5937500000000074, 0.6249999999999967], [0.6250000000000144, 0.7187499999999997], [0.6250000000000144, 0.8437500000000008], [0.5312500000000113, 0.9375000000000039], [0.40625000000001915, 1], [0.21875000000001305, 1], [0.09375000000002082, 0.9375000000000039], [1.776356839400241e-14, 0.8437500000000008]], false]],
        ],
        "t": [
            { needs_others_nearby: RequireNearbyLevel.Weak },
            [[[[0.322580645161288, 0], [0.322580645161288, 1]], false], [[[0, 0], [0.645161290322576, 0]], false]],
        ],
        "u": [
            {},
            [[[[0, 0], [0, 0.7096774193548429], [0.03225806451613672, 0.8387096774193531], [0.12903225806452856, 0.9354838709677449], [0.25806451612903875, 1], [0.3548387096774306, 1], [0.5161290322580775, 0.9354838709677449], [0.6129032258064694, 0.8387096774193531], [0.645161290322606, 0.7096774193548429], [0.645161290322606, 0]], false]],
        ],
        "v": [
            { needs_others_nearby: RequireNearbyLevel.Weak },
            [[[[0, 0], [0.3749999999999978, 1], [0.7499999999999956, 0]], false]],
        ],
        "w": [
            {},
            [[[[0, 0], [0.22222222222220817, 1], [0.44444444444441633, 0], [0.7222222222221923, 1], [0.9444444444444006, 0]], false]],
        ],

        "y": [
            {},
            [[[[0, 0], [0.3548387096774241, 0.48387096774193195], [0.3548387096774241, 1]], false], [[[0.7419354838709477, 0], [0.3548387096774058, 0.48387096774193195]], false]],
        ],

        "/": [
            { needs_others_nearby: RequireNearbyLevel.Weak, h_rel: 1.45, y_off: 0.1125 },
            [[[[0.5416666666666702, 0], [0, 1]], false]],
        ],

    })
}
