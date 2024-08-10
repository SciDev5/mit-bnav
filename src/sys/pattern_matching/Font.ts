import { Path, PathJSON } from "../structural/Path"
import { Rect2 } from "../structural/Rect2"
import { Vec2 } from "../structural/Vec2"


export enum RequireNearbyLevel {
    None,
    Weak,
    Strong,
}
export type FontSymbolWordInfo = { needs_others_nearby: number }
export type FontMatchedSymbol = { ch: string, bb: Rect2, bb_line: Rect2, i: number, n: number }
export type FontMatchedSymbolRotated = FontMatchedSymbol & { restorative_rot: Vec2 }

export class Font {
    readonly map: Map<Path[], { ch: string, h_rel: number, y_off: number }>
    readonly symbol_wordinfo: Map<string, FontSymbolWordInfo>
    readonly check_order: {
        conormalized: Path[], individual: Path[],
        conormalized_rot: Path[], individual_rot: Path[],
        pattern_restore_rotation: Vec2,
    }[]
    constructor(
        map_in: Map<string, { variants: { path: Path[], h_rel: number, y_off: number }[], info: FontSymbolWordInfo }>,
    ) {
        this.map = new Map([...map_in.entries()].flatMap(([ch, { variants }]) => variants.map(({ path, h_rel, y_off }) => [Path.conormalize(path), { ch, h_rel, y_off }])))
        this.symbol_wordinfo = new Map([...map_in.entries()].map(([char, { info }]) => [char, info]))
        console.log(this.map, this.symbol_wordinfo, map_in);

        this.check_order = [...this.map.keys()].sort((a, b) => b.length - a.length).map(v => {
            const pattern_restore_rotation = v[0].normalized_unrotated().restorative_rot
            const rotation = pattern_restore_rotation.cx_conj()
            return {
                conormalized: v,
                individual: v.map(v => v.normalized()),
                conormalized_rot: Path.conormalize(v.map(v => v.rotated(rotation))),
                individual_rot: v.map(v => v.rotated(rotation).normalized()),
                pattern_restore_rotation,
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

                const { ch, h_rel, y_off } = this.map.get(t_norm_co)!
                const bb = s.slice(i, i + n).map(s => s.bounding_box()).reduce((a, b) => a.merge(b))
                const h = bb.h / h_rel
                const bb_line = new Rect2(new Vec2(bb.x, bb.y + h * y_off), new Vec2(bb.h, h))

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
            for (const { conormalized: key, conormalized_rot: t_norm_co, individual_rot: t_norm_ind, pattern_restore_rotation } of this.check_order) {
                const n = t_norm_co.length
                if (n > n_max) continue
                if (!s_norm_ind[i].path.direct_compare(t_norm_ind[0], thresh)) continue

                const { restorative_rot } = s_norm_ind[i]
                const s_norm_co = Path.conormalize(s.slice(i, i + n).map(v => v.rotated(restorative_rot.cx_conj())))
                if (!s_norm_co.every((_, j) => s_norm_co[j].direct_compare(t_norm_co[j], thresh))) continue
                // if (!APath.direct_compare_many(s_norm_co, t_norm_co, thresh)) continue

                const { ch, h_rel, y_off } = this.map.get(key)!
                const bb = s.slice(i, i + n).map(s => s.bounding_box()).reduce((a, b) => a.merge(b))
                const h = bb.h / h_rel
                const bb_line = new Rect2(new Vec2(bb.x, bb.y + h * y_off), new Vec2(bb.h, h))

                letters.push({ ch, bb, bb_line, i, n, restorative_rot: restorative_rot.cx_times(pattern_restore_rotation.cx_conj()) })
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

            // console.log(this.symbol_wordinfo, word.str[0].ch);

            if (word.str.length === 1 && this.symbol_wordinfo.get(word.str[0].ch)!.needs_others_nearby === RequireNearbyLevel.Weak) {
                continue
            }
            if (word.str.every(({ ch }) => this.symbol_wordinfo.get(ch)!.needs_others_nearby === RequireNearbyLevel.Strong)) {
                continue
            }

            words.push(word)
        }

        const heights = words.map(v => v.bb.h).sort((a, b) => a - b)
        const median_height = heights[Math.floor(heights.length / 2)]

        return words.filter(word => Math.abs(1 - word.bb.h / median_height) < 0.5)
    }

    to_json(): FontJSON {
        const map: FontJSON["map"] = Object.fromEntries([...this.symbol_wordinfo.entries()]
            .map(([ch, info]) => ([ch, { info, variants: [] as FontJSON["map"][number]["variants"] }])))
        for (const [paths, { ch, h_rel, y_off }] of this.map) {
            map[ch].variants.push({ path: paths.map(path => path.to_json()), h_rel, y_off })
        }
        return {
            map,
        }
    }
    static from_json(json: FontJSON): Font {
        return new Font(new Map(Object.entries(json.map)
            .map(([ch, { variants: paths, info }]) => ([ch, {
                variants: paths.map(({ path, h_rel, y_off }) => ({ path: path.map(Path.from_json), h_rel, y_off })),
                info,
            }]))
        ))
    }
}


export interface FontJSON {
    map: Record<string, {
        info: FontSymbolWordInfo,
        variants: { path: PathJSON[], h_rel: number, y_off: number }[],
    }>,
}