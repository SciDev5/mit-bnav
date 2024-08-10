import { useState } from "react";
import { PathViewer } from "./PathViewer";
import { Path } from "../sys/structural/Path";

export function FloorImporter({ paths, export_scaled_paths }: { paths: Path[], export_scaled_paths: (paths: Path[]) => void }) {
    const [sel_i, set_sel_i] = useState(0)
    const [scale_len_ft, set_scale_len_ft] = useState(24)

    return (
        <div>
            <input type="number" value={scale_len_ft} onChange={e => {
                const v = e.currentTarget.valueAsNumber
                if (isFinite(v)) {
                    set_scale_len_ft(v)
                }
            }} /> ft
            <button onClick={() => {
                const scale_fac /* cm/px */ = 30.48 * scale_len_ft / paths[sel_i].bounding_box().w
                export_scaled_paths(
                    paths.map(path => new Path(
                        path.points.map(p => p.times_scalar(scale_fac)),
                        path.loop,
                        path.filled,
                    )) // path now in centimeters
                )
            }}>export</button>
            <PathViewer layers={[
                {
                    paths,
                    key: "paths",
                    sel: { sel_i: sel_i, sel_n: 1, set_i: set_sel_i },
                },
            ]} />
        </div>
    );
}