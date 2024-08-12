import { Font, FontJSON, RequireNearbyLevel } from "@/sys/pattern_matching/Font";
import { useLocalhost } from "@/sys/use";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PathSelectionInput, PathSelectionInputSingle, PathViewer, PathViewerSimple, usePathSelectionOnKeyDown, usePathSelectionState } from "./PathViewer";
import { Path } from "@/sys/structural/Path";
import { DoorMatcher, DoorPattern, doorpattern_from_json, DoorPatternJSON } from "@/sys/pattern_matching/Door";
import { Vec2 } from "@/sys/structural/Vec2";
import { Rect2 } from "@/sys/structural/Rect2";
import { Mesh2 } from "@/sys/structural/Mesh2";
import { decode_u24_pair } from "@/sys/math";
import { Floor, Room } from "@/sys/floor";


export function FloorEditor({ mesh }: { mesh: Mesh2 }) {
    const [raw_regions, set_raw_regions] = useState<number[][]>([])
    const [mesh_paths, set_mesh_paths] = useState<Path[]>([])
    const [sel_i, set_sel_i] = usePathSelectionState(0)
    const [esel_i, set_esel_i] = useState(0)
    const [psel_i, set_psel_i] = useState(0)
    // const [sel_i, sel_n, set_sel_i, set_sel_n, set_sel] = usePathSelectionState(0)
    const path_selection_on_key_down = usePathSelectionOnKeyDown(mesh_paths, sel_i, set_sel_i)

    const floor = useMemo(() => new Floor(mesh.points, [], []), [mesh])
    const [_floor_update, set_floor_update] = useState(0)
    const floor_update = useCallback(() => set_floor_update(Math.random()), [])

    const [show_rooms, set_show_rooms] = useState(false)
    const [undo_action, set_undo_action] = useState<null | (() => void)>(null)
    const [flip_action, set_flip_action] = useState<null | (() => void)>(null)

    const [cut_sel, set_cut_sel] = useState<null | number>(null)
    const [split_sel, set_split_sel] = useState<null | number>(null)
    const [join_sel, set_join_sel] = useState<null | number>(null)

    useEffect(() => {
        set_mesh_paths(mesh.to_paths())
        set_raw_regions(mesh.trace_interiors())
    }, [mesh])

    const do_add_room = () => {
        floor.rooms.push(new Room([...raw_regions[sel_i]], [], []))
        floor_update()
        set_undo_action(() => () => {
            floor.rooms.length -= 1
        })
    }
    const do_join = () => {
        if (join_sel != null) {
            set_join_sel(null)
            const [i0, i1] = [join_sel, sel_i]
            const room0 = floor.rooms[i0]
            const room1 = floor.rooms[i1]
            if (room1 == null || i0 == i1) return

            const room0_before = room0.copy()
            const room1_before = room1.copy()
            if (room0.join(room1)) {
                floor.rooms.splice(i1, 1)
                set_undo_action(() => () => {
                    floor.rooms.splice(i1, 0, room1)
                    floor.rooms[i0] = room0_before
                })
                floor_update()
            } else if (room1.join(room0)) {
                floor.rooms.splice(i0, 1)
                set_undo_action(() => () => {
                    floor.rooms.splice(i0, 0, room0)
                    floor.rooms[i1] = room1_before
                })
                floor_update()
            } else {
                alert("join failed")
            }
        } else {
            const room = floor.rooms[sel_i]
            if (room == null) return
            set_join_sel(sel_i)
        }
    }
    const do_split = () => {
        if (split_sel != null) {
            set_split_sel(null)
            const room = floor.rooms[sel_i]
            if (room == null) return
            const i = psel_i
            if (!room.path.includes(i)) return

            const cut_i = [split_sel, i] satisfies [any, any]

            const path_old = [...room.path]
            const room_new = room.copy()
            room.cut(...cut_i)
            cut_i.reverse()
            room_new.cut(...cut_i)
            floor.rooms.push(room_new)
            floor_update()
            const undo = () => {
                floor.rooms.length -= 1
                room.path.splice(0, room.path.length, ...path_old)
                floor_update()
            }
            set_undo_action(() => undo)
        } else {
            const room = floor.rooms[sel_i]
            if (room == null) return
            const i = psel_i
            if (!room.path.includes(i)) return
            set_split_sel(i)
        }
    }
    const do_cut = () => {
        if (cut_sel != null) {
            set_cut_sel(null)
            const room = floor.rooms[sel_i]
            if (room == null) return
            const i = psel_i
            if (!room.path.includes(i)) return

            const cut_i = [cut_sel, i] satisfies [any, any]

            const path_old = [...room.path]
            room.cut(...cut_i)
            floor_update()
            const undo = () => {
                room.path.splice(0, room.path.length, ...path_old)
                floor_update()
            }
            const flip = () => {
                undo()
                cut_i.reverse()
                room.cut(...cut_i)
                floor_update()
            }
            set_undo_action(() => undo)
            set_flip_action(() => flip)
        } else {
            const room = floor.rooms[sel_i]
            if (room == null) return
            const i = psel_i
            if (!room.path.includes(i)) return
            set_cut_sel(i)
        }
    }
    const do_delete = () => {
        const room = floor.rooms[sel_i]
        if (room == null) return

        floor.rooms.splice(sel_i, 1)
        floor_update()
        set_undo_action(() => () => {
            floor.rooms.splice(sel_i, 0, room)
        })
    }

    return (
        <div
            onKeyDown={e => {
                switch (e.key) {
                    case "s":
                        set_show_rooms(!show_rooms)
                        break
                    case "a":
                        if (!show_rooms) {
                            do_add_room()
                        }
                        break
                    case "e":
                        if (show_rooms) {
                            do_join()
                        }
                        break
                    case "q":
                        if (show_rooms) {
                            do_split()
                        }
                        break
                    case "x":
                        if (show_rooms) {
                            do_delete()
                        }
                        break
                    case "z":
                        undo_action?.()
                        set_undo_action(null)
                        break
                    case "f":
                        flip_action?.()
                        break
                    case "c":
                        do_cut()
                        break
                    default:
                        path_selection_on_key_down(e)
                }
            }}
            tabIndex={0}
        >
            {!show_rooms && <button onClick={() => {
                floor.rooms.push(new Room([...raw_regions[sel_i]], [], []))
                floor_update()
            }}>
                add_room
            </button>}

            <input checked={show_rooms} onChange={e => set_show_rooms(e.currentTarget.checked)} type="checkbox" />
            <PathSelectionInputSingle {...{ sel_i, set_sel_i, paths: mesh_paths }} />
            <PathViewer
                on_click={(e, p) => {
                    if (!e.ctrlKey) return
                    set_psel_i(mesh.closest_point(p))
                    set_esel_i(mesh.closest_edge(p))
                }}
                layers={[
                    // {
                    //     paths: mesh_paths,
                    //     key: "",
                    // },
                    {
                        paths: floor.rooms.map(v => new Path(v.path.map(i => floor.points[i] ?? new Vec2(0, 0)), true, false)),
                        sel: show_rooms ? {
                            sel_i,
                            sel_n: 1,
                            set_i: set_sel_i,
                        } : undefined,
                        path_class: "INTR",
                        key: "zi",
                    },
                    ...show_rooms ? [] : [
                        {
                            paths: raw_regions.map(path => new Path(path.map(vi => mesh.points[vi]), true, false)),
                            key: "z",
                            path_class: "INTR",
                            sel: {
                                sel_i,
                                sel_n: 1,
                                set_i: set_sel_i,
                            }
                        }
                    ],
                    {
                        paths: useMemo(() => {
                            const v = mesh.points[psel_i]
                            if (v == null) return []
                            const t = new Vec2(1, 0).times_scalar(5)
                            const n = t.cx_times(new Vec2(0, 1))

                            return [
                                new Path([
                                    v,
                                    v,
                                ], false, false),
                                new Path([
                                    v.plus(n),
                                    v.plus(t),
                                    v.minus(n),
                                    v.minus(t),
                                ], true, false),
                            ]
                        }, [psel_i, mesh]),
                        key: "s",
                        path_class: "LETTER"
                    },
                    // {
                    //     paths: useMemo(() => {
                    //         const [v0, v1] = decode_u24_pair(esel_i).map(i => mesh.points[i])
                    //         if (v0 == null || v1 == null) return []
                    //         const t = v1.minus(v0).normalized().times_scalar(5)
                    //         const n = t.cx_times(new Vec2(0, 1))

                    //         return [
                    //             new Path([
                    //                 v0,
                    //                 v1,
                    //             ], true, false),
                    //             new Path([
                    //                 v0.plus(n),
                    //                 v0.minus(t),
                    //                 v0.minus(n),
                    //                 v1.minus(n),
                    //                 v1.plus(t),
                    //                 v1.plus(n),
                    //             ], true, false),
                    //         ]
                    //     }, [esel_i, mesh]),
                    //     key: "s",
                    //     path_class: "LETTER"
                    // },
                ]} />
        </div>
    )
}