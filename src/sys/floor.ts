import { FontMatchedWord } from "./pattern_matching/Font"
import { Mesh2, Mesh2JSON } from "./structural/Mesh2"
import { Path, PathJSON } from "./structural/Path"
import { Rect2, Rect2JSON } from "./structural/Rect2"

export class Floor {
    private can_overwrite = false
    constructor(
        public building: string,
        public floor: number,
        readonly raw: Path[],
        public words: FontMatchedWord[],
        readonly mesh: Mesh2,
        readonly layout: FloorLayout,
    ) { }

    private static localstorage_id() {
        // if (this.building.length == 0) return null
        // return `FLOORDATA;${this.building};${this.floor}`
        return `FLOORDATA`
    }

    save_localstorage() {
        const localstorage_id = Floor.localstorage_id()
        console.log("SAVING", localstorage_id);
        if (localstorage_id == null) return
        if (!this.can_overwrite && localStorage.getItem(localstorage_id) != null && !confirm("data is present. overwrite?")) return
        this.can_overwrite = true
        localStorage.setItem(localstorage_id, JSON.stringify(this.to_json()))
    }
    static load_localstorage(): Floor | null {
        const localstorage_id = this.localstorage_id()
        if (localstorage_id == null) return null
        console.log(localstorage_id);

        const data = localStorage.getItem(localstorage_id)
        if (data == null) {
            // alert(`no data for floor ${this.floor} of '${this.building}'`)
            alert(`no data for floor`)
            return null
        }
        const floor = this.from_json(JSON.parse(data))
        floor.can_overwrite = true
        return floor
    }

    to_json(): FloorJSON {
        return {
            building: this.building,
            floor: this.floor,
            raw: this.raw.map(v => v.to_json()),
            mesh: this.mesh.to_json(),
            rooms: this.layout.rooms.map(room => ({
                info: room.info,
                path: room.path,
                path_negatives: room.path_negatives
            })),
            words: this.words.map(word => ({
                str: word.str.map(({ ch, bb, bb_line, i, n }) => ({ ch, bb: bb.to_json(), bb_line: bb_line.to_json(), i, n })),
                bb: word.bb.to_json(),
            })),
        }
    }

    static from_json(json: FloorJSON) {
        return new Floor(
            json.building,
            json.floor,
            json.raw.map(Path.from_json),
            json.words.map(word => ({
                str: word.str.map(({ ch, bb, bb_line, i, n }) => ({ ch, bb: Rect2.from_json(bb), bb_line: Rect2.from_json(bb_line), i, n })),
                bb: Rect2.from_json(word.bb),
            })),
            Mesh2.from_json(json.mesh),
            new FloorLayout(
                [],
                json.rooms.map(v => new Room(v.info, v.path, v.path_negatives))
            )
        )
    }
}
export interface FloorJSON {
    building: string,
    floor: number,
    raw: PathJSON[],
    words: { str: { ch: string, bb: Rect2JSON, bb_line: Rect2JSON, i: number, n: number }[], bb: Rect2JSON }[],
    mesh: Mesh2JSON,
    // doors: { path: number[]}[],
    rooms: { info: RoomInfo, path: number[], path_negatives: number[][] }[],
}

export interface FloorLayoutEditState {
    readonly doors: Door[],
    readonly rooms: Room[],
}

export class FloorLayout {
    constructor(
        // readonly points: Vec2[],
        readonly doors: Door[],
        readonly rooms: Room[],
    ) {
    }


    export_state(): FloorLayoutEditState {
        return {
            doors: this.doors.map(v => v.copy()),
            rooms: this.rooms.map(v => v.copy(true)),
        }
    }
    revert_state(state: FloorLayoutEditState) {
        this.doors.splice(0, this.doors.length, ...state.doors)
        this.rooms.splice(0, this.rooms.length, ...state.rooms)
    }
}

export class Door {
    constructor(
        readonly path: number[],
    ) { }

    copy() {
        return new Door([...this.path])
    }
}

export enum RoomType {
    Hallway,
    DiningHall,
    Kitchen,
    Lounge,
    Lobby,
    CommonArea,
    Bathroom,
    Sleep,
    Gym,
    Workshop,
    Other,
}
export type RoomSpec = {
    type: RoomType.Hallway
    | RoomType.DiningHall
    | RoomType.Kitchen
    | RoomType.Lounge
    | RoomType.Lobby
    | RoomType.CommonArea
    | RoomType.Gym
    | RoomType.Workshop
    | RoomType.Other
} | {
    type: RoomType.Sleep,
    capacity: number,
} | {
    type: RoomType.Bathroom,
    gendered?: "M" | "W",
}

export function roomspec_str(spec: RoomSpec) {
    switch (spec.type) {
        case RoomType.Hallway: return "hallway"
        case RoomType.DiningHall: return "dining"
        case RoomType.Kitchen: return "kitchen"
        case RoomType.Lounge: return "lounge"
        case RoomType.Lobby: return "lobby"
        case RoomType.CommonArea: return "common"
        case RoomType.Bathroom: return "bathroom" + spec.gendered ? `[${spec.gendered}]` : ""
        case RoomType.Sleep: return `sleep[${spec.capacity}]`
        case RoomType.Gym: return "gym"
        case RoomType.Workshop: return "workshop"
        case RoomType.Other: return "etc."
    }
}

export function roomtype_str(type: RoomType) {
    return {
        [RoomType.Hallway]: "hallway",
        [RoomType.DiningHall]: "dining hall",
        [RoomType.Kitchen]: "kitchen",
        [RoomType.Lounge]: "lounge",
        [RoomType.Lobby]: "lobby",
        [RoomType.CommonArea]: "common area",
        [RoomType.Bathroom]: "bathroom",
        [RoomType.Sleep]: "sleep",
        [RoomType.Gym]: "gym",
        [RoomType.Workshop]: "workshop",
        [RoomType.Other]: "other",
    }[type]
}

export interface RoomInfo {
    id: string,
    type: RoomType,
    nickname: string | null,
}

export class Room {
    constructor(
        readonly info: RoomInfo,
        readonly path: number[],
        readonly path_negatives: number[][],
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

    copy(keep_info_intact = false) {
        return new Room(
            keep_info_intact ? this.info : { ...this.info },
            [...this.path],
            this.path_negatives.map(v => [...v]),
        )
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
