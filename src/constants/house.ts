// House placement and dimensions
export const HOUSE_POSITION = { x: 0, z: -14 } as const;
export const HOUSE_WIDTH = 22; // X size (larger)
export const HOUSE_DEPTH = 22; // Z size (larger)
export const HOUSE_WALL_HEIGHT = 6.0; // taller walls
export const HOUSE_WALL_THICKNESS = 0.25;
// Roof params (match builder geometry)
export const HOUSE_ROOF_OVERHANG = 0.4; // how much roof extends past walls (x/z)
export const HOUSE_ROOF_THICKNESS = 0.12; // roof slab thickness
// Convenience: roof top Y for grounding
export const HOUSE_ROOF_TOP_Y = HOUSE_WALL_HEIGHT + HOUSE_ROOF_THICKNESS; // roof top surface

// Door dimensions (centered on front wall)
export const HOUSE_DOOR_WIDTH = 3.2; // wider doorway
export const HOUSE_DOOR_HEIGHT = 4.2; // taller doorway
export const HOUSE_DOOR_THICKNESS = 0.18;
export const HOUSE_DOOR_OPEN_ANGLE = 1.45; // ~83 degrees

// Collision sampling along walls
export const HOUSE_WALL_COLLIDER_SPACING = 0.8;
export const HOUSE_WALL_COLLIDER_RADIUS = 0.45;
export const HOUSE_DOOR_COLLIDER_RADIUS = 1.1; // easier to interact/open

// Colors
export const HOUSE_WALL_COLOR = 0xf0ead6; // light beige
export const HOUSE_TRIM_COLOR = 0xb0a080; // trim/wood
export const HOUSE_ROOF_COLOR = 0x704214; // roof

// Step (ledge) on one face to climb up
export const HOUSE_STEP_HEIGHT = HOUSE_WALL_HEIGHT * 0.5; // half the wall height
export const HOUSE_STEP_WIDTH = Math.max(6, HOUSE_WIDTH * 0.5); // span across part of the face
export const HOUSE_STEP_DEPTH = 2.0; // how far it sticks out
// Place the step on the back face (positive Z side)
export const HOUSE_STEP_LOCAL_X = 0; // centered on X
// Position step center just outside the back wall outer surface
export const HOUSE_STEP_LOCAL_Z = HOUSE_DEPTH / 2 + HOUSE_STEP_DEPTH / 2;

// Interior windows
export const WINDOW_WIDTH = 3.2;
export const WINDOW_HEIGHT = 1.8;
export const WINDOW_THICKNESS = 0.06; // thin pane
export const WINDOW_SILL_Y = 3.0; // bottom of window from floor
export const WINDOW_TINT_COLOR = 0xaad7ff; // light sky tint

// Table
export const TABLE_TOP_WIDTH = 3.0;
export const TABLE_TOP_DEPTH = 1.8;
export const TABLE_TOP_THICKNESS = 0.12;
export const TABLE_HEIGHT = 1.0;
export const TABLE_LEG_THICKNESS = 0.12;
export const TABLE_COLOR = 0x8b6b3a;
export const TABLE_COLLIDER_RADIUS = 1.1; // walking collision

// Chair
export const CHAIR_SEAT_WIDTH = 0.9;
export const CHAIR_SEAT_DEPTH = 0.9;
export const CHAIR_SEAT_THICKNESS = 0.1;
export const CHAIR_SEAT_HEIGHT = 0.55;
export const CHAIR_BACK_HEIGHT = 0.9; // above seat
export const CHAIR_LEG_THICKNESS = 0.08;
export const CHAIR_COLOR = 0x6e4f2e;
export const CHAIR_COLLIDER_RADIUS = 0.55;

// Bookshelf
export const BOOKSHELF_WIDTH = 2.0;
export const BOOKSHELF_HEIGHT = 2.4;
export const BOOKSHELF_DEPTH = 0.45;
export const BOOKSHELF_THICKNESS = 0.08;
export const BOOKSHELF_SHELF_COUNT = 4;
export const BOOKSHELF_COLOR = 0x7a5833;
export const BOOKSHELF_COLLIDER_RADIUS = 0.9;

// Bed
export const BED_WIDTH = 2.0;
export const BED_LENGTH = 3.0;
export const BED_FRAME_HEIGHT = 0.35;
export const BED_FRAME_COLOR = 0x6b4a2b;
export const MATTRESS_THICKNESS = 0.22;
export const MATTRESS_COLOR = 0xe6e6e6;
export const PILLOW_WIDTH = 1.2;
export const PILLOW_HEIGHT = 0.18;
export const PILLOW_DEPTH = 0.45;
export const PILLOW_COLOR = 0xffffff;
export const BED_COLLIDER_RADIUS = 1.1;

// Mirror
export const MIRROR_WIDTH = 2.2;
export const MIRROR_HEIGHT = 1.4;
export const MIRROR_Y = 1.2; // center height from floor
export const MIRROR_COLOR = 0x777777; // slight tint for reflector
export const MIRROR_INSET = 0.02; // push off the wall towards interior
export const MIRROR_TEXTURE_SIZE = 1024; // square render target size
