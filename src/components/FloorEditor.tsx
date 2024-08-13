import { Font, FontJSON, FontMatchedWord, RequireNearbyLevel } from "@/sys/pattern_matching/Font";
import { useLocalhost, useUpdator } from "@/sys/use";
import { ChangeEvent, useCallback, useEffect, useMemo, useState } from "react";
import { PATH_CLASSES, PathClass, PathSelectionInput, PathSelectionInputSingle, PathViewer, PathViewerSimple, usePathSelectionOnKeyDown, usePathSelectionState } from "./PathViewer";
import { Path } from "@/sys/structural/Path";
import { DoorMatcher, DoorPattern, doorpattern_from_json, DoorPatternJSON } from "@/sys/pattern_matching/Door";
import { Vec2 } from "@/sys/structural/Vec2";
import { Rect2 } from "@/sys/structural/Rect2";
import { Mesh2 } from "@/sys/structural/Mesh2";
import { decode_u24_pair } from "@/sys/math";
import { Door, Floor, FloorLayout, FloorLayoutEditState, Room, RoomInfo, RoomSpec, roomspec_str, RoomType, roomtype_str } from "@/sys/floor";

import styles from "./flooreditor.module.css"

const PATH_CLASS_ZONE: PathClass = {
    styles,
    base: styles.path_zone
}
const PATH_CLASS_ROOM: PathClass = {
    styles,
    base: styles.path_room
}

function guess_update_roominfo(room: Room, mesh: Mesh2, words_match: FontMatchedWord[]): boolean {
    const room_info = room.info
    const bb = Rect2.from_points(...room.path.map(i => mesh.points[i]))
    const bb_center = bb.pos.plus(bb.dim.times_scalar(0.5))
    const guess_id = words_match
        .map(v => {
            if (!v.bb.intersects(bb)) return null
            const text = v.str.map(v => v.ch).join("")
            if (!/^\d\d+[a-z]*$/.test(text)) return null
            return {
                data: { v, text },
                dist: v.bb.pos.plus(v.bb.dim.times_scalar(0.5)).dist_sq(bb_center)
            }
        })
        .filter(v => v != null)
        .reduce((a, b) => a.dist < b.dist ? a : b, { data: null as { v: FontMatchedWord, text: string } | null, dist: Infinity })
        .data
    if (guess_id == null) return false

    room_info.id = guess_id.text
    const idbb_center = guess_id.v.bb.pos.plus(guess_id.v.bb.dim.times_scalar(0.5))


    const guess_type_str = words_match
        .map(v => {
            if (v === guess_id.v) return null
            return { v, dist: v.bb.pos.plus(v.bb.dim.times_scalar(0.5)).dist_sq(idbb_center) }
        })
        .filter(v => v != null)
        .reduce((a, b) => a.dist < b.dist ? a : b, { v: null as FontMatchedWord | null, dist: Infinity })
        .v?.str.map(v => v.ch).join("")

    const guess_type: RoomType = {
        "": room_info.type,
        bath: RoomType.Bathroom,
        corr: RoomType.Hallway,
        foodsv: RoomType.Kitchen,
        food: RoomType.DiningHall,
        lounge: RoomType.Lounge,
        lobby: RoomType.Lobby,
        sleep: RoomType.Sleep,
    }[guess_type_str?.replaceAll(/0/g, "o") ?? ""] ?? RoomType.Other

    room_info.type = guess_type
    return true
}

export function RoomInfoEditor({
    mesh,
    room,
    words_match,
    direct_update_floor,
}: {
    mesh: Mesh2,
    room: Room,
    words_match: FontMatchedWord[],
    direct_update_floor: () => void,
}) {
    const room_info = room.info
    const rerender = useUpdator()

    return (<div>
        <button
            onClick={() => {
                if (guess_update_roominfo(room, mesh, words_match)) {
                    rerender()
                    direct_update_floor()
                }
            }}
        >
            guess
        </button>
        id <input
            value={room_info.id}
            onChange={useCallback((e: ChangeEvent<HTMLInputElement>) => {
                room_info.id = e.currentTarget.value
                rerender()
                direct_update_floor()
            }, [rerender, room_info])}
        />

        <span>{roomtype_str(room_info.type)}</span>

        nickname <input
            value={room_info.nickname ?? ""}
            onChange={useCallback((e: ChangeEvent<HTMLInputElement>) => {
                room_info.nickname = e.currentTarget.value
                if (room_info.nickname.trim() === "") {
                    room_info.nickname = null
                }
                rerender()
                direct_update_floor()
            }, [rerender, room_info])}
        />
    </div>)

}

export function FloorEditor({
    floor,
    mark_floor_changed,
}: {
    floor: Floor,
    mark_floor_changed: () => void,
}) {
    const { layout: floor_layout, mesh, words: words_match } = floor

    const [raw_regions, set_raw_regions] = useState<number[][]>([])
    const [mesh_paths, set_mesh_paths] = useState<Path[]>([])
    const [sel_i, set_sel_i] = usePathSelectionState(0)
    const [sel_j, set_sel_j] = useState<null | number>(null)
    const [point_i0, set_point_i0] = useState(0)
    const [point_i1, set_point_i1] = useState<null | number>(null)
    const path_selection_on_key_down = usePathSelectionOnKeyDown(mesh_paths, sel_i, set_sel_i)

    const rerender = useUpdator()
    const direct_update_floor = useCallback(() => {
        mark_floor_changed()
        rerender()
    }, [mark_floor_changed])

    const [show_rooms, set_show_rooms] = useState(false)
    const undo_stack = useMemo<(FloorLayoutEditState | (() => void))[]>(() => [], [floor_layout])
    const [flip_action, set_flip_action] = useState<null | (() => void)>(null)

    const update = useCallback((
        undo_state: FloorLayoutEditState | (() => void),
        flip_action?: () => void,
    ) => {
        undo_stack.push(undo_state)
        set_flip_action((() => flip_action) ?? null)
        direct_update_floor()
    }, [])
    const undo = useCallback(() => {
        const undo_state = undo_stack.pop()
        if (undo_state == null) return
        if (undo_state instanceof Function) {
            undo_state()
        } else {
            floor_layout.revert_state(undo_state)
        }
        direct_update_floor()
    }, [])
    const flip = useCallback(flip_action ? () => {
        flip_action()
        direct_update_floor()
    } : () => { }, [flip_action])

    useEffect(() => {
        set_mesh_paths(mesh.to_paths())
        set_raw_regions(mesh.trace_interiors())
    }, [mesh])

    const do_add_room = useCallback((zone_i: number) => {
        floor_layout.rooms.push(new Room(
            { id: "", type: RoomType.Other, nickname: null },
            [...raw_regions[zone_i]],
            [],
        ))

        const undo_state = () => { floor_layout.rooms.length -= 1 }
        update(undo_state)
    }, [floor_layout, update, raw_regions])
    const do_join = useCallback((room_i0: number, room_i1: number) => {
        const room0 = floor_layout.rooms[room_i0]
        const room1 = floor_layout.rooms[room_i1]

        const room0_before = room0.copy()
        const room1_before = room1.copy()
        if (room0.join(room1)) {
            floor_layout.rooms.splice(room_i1, 1)
            set_sel_i(floor_layout.rooms.indexOf(room0))
            set_sel_j(null)
            const undo_state = () => {
                floor_layout.rooms.splice(room_i1, 0, room1)
                floor_layout.rooms[room_i0] = room0_before
            }
            update(undo_state)
        } else if (room1.join(room0)) {
            floor_layout.rooms.splice(room_i0, 1)
            set_sel_i(floor_layout.rooms.indexOf(room1))
            set_sel_j(null)
            const undo_state = () => {
                floor_layout.rooms.splice(room_i0, 0, room0)
                floor_layout.rooms[room_i1] = room1_before
            }
            update(undo_state)
        } else {
            alert("join failed")
        }
    }, [floor_layout, update])
    const do_split = useCallback((room: Room, point_i0: number, point_i1: number) => {
        const cut_i = [point_i0, point_i1] satisfies [any, any]

        const path_old = [...room.path]
        const room_new = room.copy()
        room.cut(...cut_i)
        cut_i.reverse()
        room_new.cut(...cut_i)
        floor_layout.rooms.push(room_new)
        const undo_state = () => {
            floor_layout.rooms.length -= 1
            room.path.splice(0, room.path.length, ...path_old)
        }
        update(undo_state)
    }, [floor_layout, update])
    const do_cut = useCallback((room: Room, point_i0: number, point_i1: number) => {
        const cut_i = [point_i0, point_i1] satisfies [any, any]

        const path_old = [...room.path]
        room.cut(...cut_i)
        const undo_state = () => {
            room.path.splice(0, room.path.length, ...path_old)
        }
        const flip_action = () => {
            undo_state()
            cut_i.reverse()
            room.cut(...cut_i)
        }
        update(undo_state, flip_action)
    }, [update])
    const do_delete = useCallback((room_i: number) => {
        const room = floor_layout.rooms[room_i]

        floor_layout.rooms.splice(room_i, 1)
        const undo_state = () => {
            floor_layout.rooms.splice(room_i, 0, room)
        }
        update(undo_state)
    }, [floor_layout, update])

    const set_sel_i_clear_j = useCallback((i: number) => {
        set_sel_i(i)
        set_sel_j(null)
    }, [set_sel_i, set_sel_j])
    const set_sel_j_move_i = useCallback((i: number) => {
        if (i === sel_i) return
        set_sel_i(i)
        set_sel_j(sel_i)
    }, [set_sel_i, set_sel_j, sel_i])
    const l0 = {
        paths: floor_layout.rooms.map(v => new Path(v.path.map(i => mesh.points[i] ?? new Vec2(0, 0)), true, false)),
        sel: show_rooms ? {
            sel_i,
            sel_n: 1,
            set_i: set_sel_i_clear_j,
            shift_set_i: set_sel_j_move_i,
        } : undefined,
        path_class: PATH_CLASS_ROOM,
        key: "zi",
    }
    const l1 = {
        paths: (show_rooms ? raw_regions.slice(0, 1) : raw_regions).map(path => new Path(path.map(vi => mesh.points[vi]), true, false)),
        key: "z",
        path_class: PATH_CLASS_ZONE,
        sel: show_rooms ? undefined : {
            sel_i,
            sel_n: 1,
            set_i: set_sel_i,
        }
    }
    const s0 = {
        paths: useMemo(() => {

            const p0 = mesh.points[point_i0]
            if (p0 == null) return []
            const p1 = mesh.points[point_i1 ?? -1] ?? p0.plus(new Vec2(0.001, 0))
            console.log(p0, p1);
            const t = p1.minus(p0).normalized().times_scalar(5)
            const n = t.cx_times(new Vec2(0, 1))

            return [
                new Path([
                    p0,
                    p1,
                ], true, false),
                new Path([
                    p0.plus(n),
                    p0.minus(t),
                    p0.minus(n),
                    p1.minus(n),
                    p1.plus(t),
                    p1.plus(n),
                ], true, false),
            ]
        }, [point_i0, point_i1, mesh]),
        key: "s",
        path_class: PATH_CLASSES.ANNOT,
    }
    const s1 = {
        paths: useMemo(() => {
            const room = floor_layout.rooms[sel_j ?? -1]
            if (room == null) return []
            return [
                new Path(room.path.map(i => mesh.points[i]), true, false)
            ]
        }, [floor_layout, sel_j]),
        key: "sj",
        path_class: PATH_CLASSES.ANNOT,
    }

    return (
        <div
            onKeyDown={e => {
                if (e.target instanceof HTMLInputElement) return

                const room: Room | null = floor_layout.rooms[sel_i] ?? null
                const room_second: Room | null = floor_layout.rooms[sel_j ?? -1] ?? null
                switch (e.key) {
                    case "s":
                        set_show_rooms(!show_rooms)
                        break
                    case "a":
                        if (!show_rooms && raw_regions[sel_i]) {
                            do_add_room(sel_i)
                        }
                        break
                    case "e":
                        if (show_rooms && room != null && room_second != null) {
                            do_join(sel_i, sel_j!)
                        }
                        break
                    case "q":
                        if (show_rooms && room != null && point_i0 != null && point_i1 != null && room.path.includes(point_i0) && room.path.includes(point_i1)) {
                            do_split(room, point_i0, point_i1)
                        }
                        break
                    case "x":
                        if (show_rooms && room != null) {
                            do_delete(sel_i)
                        }
                        break
                    case "c":
                        if (show_rooms && room != null && point_i0 != null && point_i1 != null) {
                            do_cut(room, point_i0, point_i1)
                        }
                        break
                    case "w":
                        if (show_rooms && room != null) {
                            if (guess_update_roominfo(room, floor.mesh, floor.words)) {
                                rerender()
                                direct_update_floor()
                            }
                        }
                        break
                    case "z":
                        undo()
                        break
                    case "f":
                        flip()
                        break
                    default:
                        path_selection_on_key_down(e)
                }
            }}
            tabIndex={0}
        >
            <input value={floor.building} onChange={e => {
                floor.building = e.currentTarget.value
                direct_update_floor()
            }} />
            <input value={floor.floor} type="number" onChange={e => {
                const n = e.currentTarget.valueAsNumber
                if (!isFinite(n)) return
                floor.floor = n
                direct_update_floor()
            }} />
            {show_rooms && (<>
                {floor_layout.rooms[sel_i] && <RoomInfoEditor mesh={mesh} words_match={words_match} room={floor_layout.rooms[sel_i]} direct_update_floor={direct_update_floor} />}
            </>)}
            <PathViewer
                on_click={(e, p) => {
                    if (!e.ctrlKey) return
                    const i = mesh.closest_point(p)
                    if (e.shiftKey) {
                        set_point_i1(i)
                    } else {
                        set_point_i0(i)
                        set_point_i1(null)
                    }
                }}
                layers={[
                    s0,
                    ...show_rooms ? [l1, l0] : [l0, l1],
                    s1,
                ]}
                text={floor_layout.rooms.map(v => {
                    const { id, type, nickname } = v.info
                    const type_str = roomtype_str(type)

                    if (id.length === 0) return null

                    const bb = Rect2.from_points(...v.path.map(i => mesh.points[i]))

                    return {
                        text: id + "\n" + type_str + (nickname != null ? "\n\"" + nickname + "\"" : ""),
                        pos: bb.pos.plus(bb.dim.times_scalar(0.5)),
                    }
                }).filter(v => v != null)}
            />
        </div>
    )
}