'use client';

import styles from "./page.module.css";
import { useCallback, useEffect, useState } from "react";
import { Path } from "@/sys/structural/Path";
import { FloorImporter } from "@/components/FloorImporter";
import { FontEditor, useFont, useFontJSON } from "@/components/FontEditor";
import { Mesh2 } from "@/sys/structural/Mesh2";
import { Rect2 } from "@/sys/structural/Rect2";
import { Vec2 } from "@/sys/structural/Vec2";
import { FloorEditor } from "@/components/FloorEditor";
import { Floor, FloorJSON, FloorLayout } from "@/sys/floor";
import Link from "next/link";
import { FloorViewer } from "@/components/FloorViewer";


export default function Home() {
    return (<>
        <Link href="./editor/">editor</Link>
        <FloorViewer />
    </>)
}
