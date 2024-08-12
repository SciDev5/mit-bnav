import { assert, THROW } from "../assertion";
import { decode_u24_pair, encode_u24_pair_unordered, line_line_intersect_t_a, point_line_dist, U24PairUnordered } from "../math";
import { Path } from "./Path";
import { Rect2 } from "./Rect2";
import { Vec2 } from "./Vec2";


export class Mesh2 {
    private constructor(
        private points: Vec2[],
        private edges: Set<U24PairUnordered>,
    ) { }


    static from_paths(paths: Path[]): Mesh2 {
        const points = []
        const edges = new Set<U24PairUnordered>()

        for (const path of paths) {
            const i0 = points.length
            points.push(...path.points)
            for (let i = 0; i < path.points.length - 1; i++) {
                edges.add(encode_u24_pair_unordered(i0 + i, i0 + i + 1))
            }
            if (path.loop) {
                edges.add(encode_u24_pair_unordered(i0, i0 + path.points.length - 1))
            }
        }

        return new Mesh2(points.map(v => v.copy()), edges)
    }

    private point_n_edges(): number[] {
        const point_n_edges = this.points.map(() => 0)
        for (const edge of this.edges) {
            const [i0, i1] = decode_u24_pair(edge)
            point_n_edges[i0] += 1
            point_n_edges[i1] += 1
        }
        return point_n_edges
    }
    private edge_lut(): number[][] {
        const edge_lut: number[][] = this.points.map(() => [])
        for (const edge of this.edges) {
            const [i0, i1] = decode_u24_pair(edge)
            edge_lut[i0].push(i1)
            edge_lut[i1].push(i0)
        }
        return edge_lut
    }

    jitter(scale: number) {
        this.points.forEach(v => {
            v.x += scale * Math.random()
            v.y += scale * Math.random()
        })
    }
    splice_line_intersections(thresh: number) {
        const thresh_sq = thresh * thresh

        const intersections: { iea: number, ieb: number, point_i: number }[] = []
        const edges_old = [...this.edges.values()]
        const edges_endpoints_i = edges_old.map(edge => decode_u24_pair(edge))
        const edges_endpoints = edges_old.map(edge => decode_u24_pair(edge).map(i => this.points[i]) as [Vec2, Vec2])
        // console.log(edges_endpoints);

        const edge_bbs = edges_endpoints.map(v => Rect2.from_points(...v))
        const edge_normals = edges_endpoints.map(([v0, v1]) => v1.minus(v0).normalized())

        const tips = this.point_n_edges().map((v, i) => v <= 1 ? i : null).filter(v => v != null)
        const tip_intersections: { from_point_i: number, to_ei: number, point_i: number }[] = []

        for (const vi of tips) {
            const v = this.points[vi]
            let closest = { dist_sq: Infinity, t_a: NaN, p_line: new Vec2(0, 0) } satisfies ReturnType<typeof point_line_dist>
            let closest_i = -1
            for (let ei = 0; ei < edges_old.length; ei++) {
                const [a0, a1] = edges_endpoints[ei]
                if (a0 === v || a1 === v) continue
                const match = point_line_dist(a0, a1, v)
                if (match.dist_sq < closest.dist_sq) {
                    closest_i = ei
                    closest = match
                }
            }

            if (closest.dist_sq > thresh_sq) continue
            let point_i = -1
            for (const vni of decode_u24_pair(edges_old[closest_i])) {
                if (this.points[vni].dist_sq(v) < thresh_sq) {
                    point_i = vni
                }
            }
            if (point_i === -1) {
                point_i = this.points.length
                this.points.push(closest.p_line)
            }

            tip_intersections.push({ from_point_i: vi, to_ei: closest_i, point_i })
        }

        for (let iea = 0; iea < edges_old.length; iea++) {
            const [a0, a1] = edges_endpoints[iea]
            // const [a0i, a1i] = edges_endpoints_i[iea]
            for (let ieb = iea + 1; ieb < edges_old.length; ieb++) {
                const [b0, b1] = edges_endpoints[ieb]
                // const [b0i, b1i] = edges_endpoints_i[ieb]
                if (a0 === b0 || a1 === b0 || a0 === b1 || a1 === b1) continue
                if (!edge_bbs[iea].intersects(edge_bbs[ieb])) continue

                const { p } = line_line_intersect_t_a(a0, a1, b0, b1)
                if (p == null) continue

                // console.log(t_a, p, a0, a1, b0, b1);

                const point_i = this.points.length
                this.points.push(p)
                intersections.push({ iea, ieb, point_i })
            }
        }

        const intersections_by_edge = edges_old.map(() => [] as ((typeof intersections)[number] | (typeof tip_intersections)[number])[])
        for (let i = 0; i < intersections.length; i++) {
            intersections_by_edge[intersections[i].iea].push(intersections[i])
            intersections_by_edge[intersections[i].ieb].push(intersections[i])
        }
        for (let i = 0; i < tip_intersections.length; i++) {
            intersections_by_edge[tip_intersections[i].to_ei].push(tip_intersections[i])
        }


        const edges_new = new Set<U24PairUnordered>()
        for (let ei = 0; ei < intersections_by_edge.length; ei++) {
            const n = edge_normals[ei]
            const inters = intersections_by_edge[ei]
                .sort((a, b) => n.dot(this.points[a.point_i]) - n.dot(this.points[b.point_i]))

            const [i0, ilast] = decode_u24_pair(edges_old[ei])
            const point_indices = [i0, ...inters.map(v => v.point_i), ilast]
            for (let i = 0; i < point_indices.length - 1; i++) {
                edges_new.add(encode_u24_pair_unordered(point_indices[i], point_indices[i + 1]))
            }
        }
        for (const { from_point_i, point_i } of tip_intersections) {
            edges_new.add(encode_u24_pair_unordered(from_point_i, point_i))
        }
        this.edges = edges_new
    }

    merge_by_dist_simple(thresh: number) {
        const points = this.points
            .map((p, i) => ({
                p,
                l: Math.round(p.x / thresh) * Math.PI + Math.round(p.y / thresh),
                i,
            }))
            .toSorted((a, b) => a.l - b.l)
        const points_out: { p: Vec2, i: number[] }[] = []
        for (let i = points.length - 2; i >= -1; i--) {
            if (points[i]?.l === points[i + 1].l) continue

            const points_to_merge = points.splice(i + 1)
            points_out.push({
                p: points_to_merge
                    .map(({ p }) => p)
                    .reduce((a, b) => a.plus(b))
                    .times_scalar(1 / points_to_merge.length),
                i: points_to_merge
                    .map(({ i }) => i),
            })
        }

        points_out.reverse()
        const index_map = new Array(points.length).fill(-1)
        for (let j = 0; j < points_out.length; j++) {
            for (const i of points_out[j].i) {
                index_map[i] = j
            }
        }

        this.points = points_out.map(({ p }) => p)
        this.edges = new Set(
            [...this.edges.values()]
                .map(edge => encode_u24_pair_unordered(
                    ...decode_u24_pair(edge)
                        .map(i => index_map[i]) as [number, number]
                ))
        )

    }

    to_paths(): Path[] {
        const point_n_edges = this.point_n_edges()
        const unfinished = new Set(
            point_n_edges
                .map((v, i) => [v, i] as const)
                .filter(([v,]) => v > 0)
                .map(([, i]) => i)
        )
        const edge_lut = this.edge_lut()

        const paths = []
        while (unfinished.size > 0) {
            let i = (unfinished.values().next() as IteratorYieldResult<U24PairUnordered>).value
            const i0 = i
            let loop = false
            const path_points = [this.points[i].copy()]
            while (true) {
                const j = edge_lut[i].pop()
                if (j == null) break
                edge_lut[j].splice(edge_lut[j].indexOf(i), 1)

                if (j === i0) {
                    loop = true
                } else {
                    path_points.push(this.points[j].copy())
                }

                if (edge_lut[i].length === 0) unfinished.delete(i)
                if (edge_lut[j].length === 0) unfinished.delete(j)

                if (loop) { break }
                i = j
            }
            if (!loop) {
                path_points.reverse()

                const i0opposite = i
                i = i0
                while (true) {
                    const j = edge_lut[i].pop()
                    if (j == null) break
                    edge_lut[j].splice(edge_lut[j].indexOf(i), 1)

                    if (j === i0opposite) {
                        loop = true
                    } else {
                        path_points.push(this.points[j].copy())
                    }

                    if (edge_lut[i].length === 0) unfinished.delete(i)
                    if (edge_lut[j].length === 0) unfinished.delete(j)

                    if (loop) { break }
                    i = j
                }

            }
            paths.push(new Path(path_points, loop, false))
        }

        return paths
    }
}