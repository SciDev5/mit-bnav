import { Path, PathJSON } from "../structural/Path"
import { Rect2 } from "../structural/Rect2"
import { Vec2 } from "../structural/Vec2"
import { Font, FontSymbolWordInfo, RequireNearbyLevel } from "./Font"

export class DoorMatcher {
    private readonly font: Font
    private readonly patterns: Map<string, { pattern: DoorPattern, flip: boolean }>
    constructor(
        patterns: DoorPattern[]
    ) {
        this.patterns = new Map(patterns.flatMap((pattern, i) => [[i + "L", { pattern, flip: false }], [i + "R", { pattern, flip: true }]] satisfies [any, any][]))
        this.font = new Font(new Map([...this.patterns.entries()].map(([id, { pattern: { path }, flip }]) => [id, {
            variants: [{ path: flip ? path.map(v => v.flipped_xy()) : path, h_rel: 1, y_off: 0, }],
            info: { needs_others_nearby: RequireNearbyLevel.None } as FontSymbolWordInfo,
        }])))
    }

    find_doors(paths: Path[], thresh = 0.01): DoorMatch[] {
        const matches = this.font.find_symbols_rotated(paths, thresh)
        return matches.map(({ bb, ch, i, n, restorative_rot }) => ({
            bb,
            i,
            n,
            rotation: restorative_rot,
            ...this.patterns.get(ch)!
        }))
    }
}


export interface DoorMatch {
    i: number,
    n: number,
    pattern: DoorPattern,
    /// represents pattern flipped over x=y line *before* rotation
    flip: boolean,
    /// the rotation required to get the template pattern to resemble the matched region
    rotation: Vec2,
    /// the bounding box of the matched region
    bb: Rect2,
}


export interface DoorPattern {
    /// all door pattern paths must be oriented hinge near (0,0) opening out to the +x direction (closed door line)
    path: Path[],
    /// denotes which paths in the door should be removed to prepare for room detection remesh. (true denotes entire Path removed)
    paths_cut: (true | { start: number, end: number })[],
}
export interface DoorPatternJSON {
    path: PathJSON[],
    paths_cut: (true | [number, number])[],
}
export function doorpattern_to_json(pat: DoorPattern): DoorPatternJSON {
    return {
        path: pat.path.map(path => path.to_json()),
        paths_cut: pat.paths_cut.map(pc => pc === true ? true : [pc.start, pc.end]),
    }
}
export function doorpattern_from_json(pat: DoorPatternJSON): DoorPattern {
    return {
        path: pat.path.map(Path.from_json),
        paths_cut: pat.paths_cut.map(pc => pc === true ? true : { start: pc[0], end: pc[1] }),
    }
}
