<!-- BasemapVectorTileSource.svelte -->
<script lang="ts">
  import { VectorTileSource, LineLayer, SymbolLayer, FillLayer } from "svelte-maplibre"

</script>

<VectorTileSource
  id="basemap"
  tiles={["mbtiles://./basemap/{z}/{x}/{y}"]}
  minzoom={0}
  maxzoom={14}
  promoteId={"id"}
>
  <FillLayer
    id="basemap-park-fill-park"
    sourceLayer={"park"}
    beforeLayerType="symbol"
    filter={["all", ["==", "subclass", "park"]]}
    paint={{
      "fill-color": "#cae2cc",
      "fill-opacity": 1,
    }}
  ></FillLayer>
  <FillLayer
    id="basemap-landuse-fill-residential-suburb-neighbourhood"
    sourceLayer={"landuse"}
    beforeLayerType="symbol"
    filter={[
      "all",
      ["in", "subclass", "residential" as any, "suburb" as any, "neighbourhood" as any],
    ] as any}
    paint={{
      "fill-color": {
        base: 1,
        stops: [
          [12, "hsla(30, 19%, 90%, 0.4)"],
          [16, "hsla(30, 19%, 90%, 0.2)"],
        ],
      } as any,
    }}
  ></FillLayer>
  <FillLayer
    id="basemap-landuse-fill-farmland"
    sourceLayer={"landuse"}
    beforeLayerType="symbol"
    filter={["all", ["==", "$type", "Polygon"], ["==", "subclass", "farmland"]]}
    paint={{
      "fill-color": "#e3e6c3",
      "fill-opacity": 1,
    }}
  ></FillLayer>
  <FillLayer
    id="basemap-landuse-fill-commercial"
    sourceLayer={"landuse"}
    beforeLayerType="symbol"
    filter={[
      "all",
      ["==", "$type", "Polygon"],
      ["==", "subclass", "commercial"],
    ]}
    paint={{
      "fill-color": "hsla(0, 60%, 87%, 0.23)",
    }}
  ></FillLayer>
  <FillLayer
    id="basemap-landuse-fill-industrial-garages-dam"
    sourceLayer={"landuse"}
    beforeLayerType="symbol"
    filter={[
      "all",
      ["==", "$type", "Polygon"],
      ["in", "subclass", "industrial" as any, "garages" as any, "dam" as any],
    ] as any}
    paint={{
      "fill-color": "hsla(243, 63%, 88%, 0.34)",
    }}
  ></FillLayer>
  <FillLayer
    id="basemap-landuse-fill-cemetery"
    sourceLayer={"landuse"}
    beforeLayerType="symbol"
    filter={["all", ["==", "$type", "Polygon"], ["==", "category", "cemetery"]]}
    paint={{
      "fill-color": "#e0e4dd",
    }}
  ></FillLayer>
  <FillLayer
    id="basemap-landuse-fill-healthcare"
    sourceLayer={"landuse"}
    beforeLayerType="symbol"
    filter={["all", ["==", "$type", "Polygon"], ["==", "class", "healthcare"]]}
    paint={{
      "fill-color": "#fde",
    }}
  ></FillLayer>
  <FillLayer
    id="basemap-landuse-fill-education"
    sourceLayer={"landuse"}
    beforeLayerType="symbol"
    filter={["all", ["==", "$type", "Polygon"], ["==", "class", "education"]]}
    paint={{
      "fill-color": "#f0e8f8",
    }}
  ></FillLayer>
  <FillLayer
    id="basemap-landuse-fill-rail"
    sourceLayer={"landuse"}
    beforeLayerType="symbol"
    filter={[
      "all",
      ["==", "class", "transportation"],
      ["==", "subclass", "rail"],
    ]}
    paint={{
      "fill-color": "hsla(30, 19%, 90%, 0.4)",
    }}
  ></FillLayer>
  <FillLayer
    id="basemap-landcover-fill-wood"
    sourceLayer={"landcover"}
    beforeLayerType="symbol"
    filter={["all", ["==", "subclass", "wood"]]}
    paint={{
      "fill-antialias": {
        base: 1,
        stops: [
          [0, false],
          [9, true],
        ],
      } as any,
      "fill-color": "#66aa44",
      "fill-opacity": 0.1,
      "fill-outline-color": "hsla(0, 0%, 0%, 0.03)",
    }}
  ></FillLayer>
  <FillLayer
    id="basemap-landcover-fill-uncultivated"
    sourceLayer={"landcover"}
    beforeLayerType="symbol"
    filter={["all", ["==", "subclass", "uncultivated"]]}
    paint={{
      "fill-color": "#d9ead3",
      "fill-opacity": 1,
    }}
  ></FillLayer>
  <FillLayer
    id="basemap-landuse-fill-transportation-parking"
    sourceLayer={"landuse"}
    beforeLayerType="symbol"
    filter={[
      "all",
      ["==", "class", "transportation"],
      ["==", "category", "car_parking"],
    ]}
    paint={{
      "fill-color": "red",
      "fill-pattern": "hatching-pattern",
    }}
  ></FillLayer>
  <FillLayer
    id="basemap-landuse-fill-leisure-sport-sports_centre"
    sourceLayer={"landuse"}
    beforeLayerType="symbol"
    filter={[
      "all",
      ["==", "class", "leisure"],
      ["==", "category", "sports_centre"],
    ]}
    paint={{
      "fill-color": "#c7d4c9",
    }}
  ></FillLayer>
  <FillLayer
    id="basemap-landcover-fill-leisure-outdoor-garden"
    sourceLayer={"landcover"}
    beforeLayerType="symbol"
    filter={["all", ["==", "class", "leisure"], ["==", "category", "garden"]]}
    paint={{
      "fill-color": "#62a63f",
      "fill-opacity": 0.3,
    }}
  ></FillLayer>
  <FillLayer
    id="basemap-landuse-fill-leisure-sport-pitch"
    sourceLayer={"landuse"}
    beforeLayerType="symbol"
    filter={["all", ["==", "class", "leisure"], ["==", "category", "pitch"]]}
    paint={{
      "fill-color": "#c7d4c9",
    }}
  ></FillLayer>
  <FillLayer
    id="basemap-landuse-fill-leisure-recreational-playground"
    sourceLayer={"landuse"}
    beforeLayerType="symbol"
    filter={[
      "all",
      ["==", "class", "leisure"],
      ["==", "category", "playground"],
    ]}
    paint={{
      "fill-color": "#c7d4c9",
    }}
  ></FillLayer>
  <FillLayer
    id="basemap-water-fill-offset"
    sourceLayer={"water"}
    beforeLayerType="symbol"
    filter={["==", "$type", "Polygon"]}
    paint={{
      "fill-color": "#a6c3d8",
      "fill-opacity": 1,
      "fill-translate": {
        base: 1,
        stops: [
          [6, [2, 0]],
          [8, [0, 0]],
        ],
      } as any,
    }}
  ></FillLayer>
  <FillLayer
    id="basemap-water-fill"
    sourceLayer={"water"}
    beforeLayerType="symbol"
    filter={["all", ["!=", "intermittent", "yes"], ["!=", "brunnel", "tunnel"]]}
    paint={{
      "fill-color": "#a6c3d8",
      "fill-opacity": 1,
    }}
  ></FillLayer>
  <FillLayer
    id="basemap-water-fill-intermittent"
    sourceLayer={"water"}
    beforeLayerType="symbol"
    maxzoom={8}
    filter={["all", ["==", "intermittent", "yes"]]}
    paint={{
      "fill-color": "#bfd9f2",
      "fill-opacity": 0.7,
    }}
  ></FillLayer>
  <FillLayer
    id="basemap-landuse-fill-grass"
    sourceLayer={"landuse"}
    beforeLayerType="symbol"
    filter={["all", ["==", "subclass", "grass"]]}
    paint={{
      "fill-color": "#d8e8c8",
      "fill-opacity": 1,
    }}
  ></FillLayer>
  <FillLayer
    id="basemap-landcover-fill-grass"
    sourceLayer={"landcover"}
    beforeLayerType="symbol"
    filter={["all", ["==", "subclass", "grass"]]}
    paint={{
      "fill-color": "#d8e8c8",
      "fill-opacity": 1,
    }}
  ></FillLayer>
   <FillLayer
    id="basemap-landcover-fill-bare_rock"
    sourceLayer={"landcover"}
    beforeLayerType="symbol"
    filter={["all", ["==", "subclass", "bare_rock"]]}
    paint={{
      "fill-pattern":"bare_rock",
    }}
  ></FillLayer>
  <LineLayer
    id="basemap-landcover-cliff-outline"
    sourceLayer={"landcover"}
    filter={["all", ["==", "subclass", "cliff"]]}
    paint={{
      "line-color": "#4a4848",
      "line-width": {
        "base": 1,
        "stops": [
          [12, 0],
          [13, 1]
        ]
      } as any,
      "line-opacity": {
        "base": 1,
        "stops": [
          [12, 0],
          [13, 1]
        ]
      } as any,
    }}
  ></LineLayer>
  <LineLayer
    id="basemap-landuse-grass-outline"
    sourceLayer={"landuse"}
    filter={["all", ["==", "subclass", "grass"]]}
    paint={{
      "line-color": "#99c79c",
      "line-width": {
        "base": 1,
        "stops": [
          [12, 0],
          [13, 1]
        ]
      } as any,
      "line-opacity": {
        "base": 1,
        "stops": [
          [12, 0],
          [13, 1]
        ]
      } as any,
    }}
  ></LineLayer>
  <LineLayer
    id="basemap-landuse-barrier-outline"
    sourceLayer={"landuse"}
    filter={["all", ["==", "subclass", "barrier"]]}
    paint={{
      "line-color": "#b4b4b4",
      "line-width": {
        "base": 1,
        "stops": [
          [12, 0],
          [13, 1]
        ]
      } as any,
      "line-opacity": {
        "base": 1,
        "stops": [
          [12, 0],
          [13, 1]
        ]
      } as any,
    }}
  ></LineLayer>
  <FillLayer
    id="basemap-landcover-fill-natural-wetland"
    sourceLayer={"landcover"}
    beforeLayerType="symbol"
    filter={["==", "subclass", "wetland"]}
    paint={{
      "fill-color": "#d0e0e3",
      "fill-opacity": 1,
    }}
  ></FillLayer>
  <FillLayer
    id="basemap-landcover-fill-natural-sand"
    sourceLayer={"landcover"}
    beforeLayerType="symbol"
    filter={["all", ["==", "subclass", "sand"]]}
    paint={{
      "fill-color": "#f5eebc",
      "fill-opacity": 1,
    }}
  ></FillLayer>
  <LineLayer
    id="basemap-landuse-sport-downhill"
    sourceLayer={"landuse"}
    filter={["all", ["==", "subclass", "sport"]]}
    paint={{
      "line-color": [
        "case",
        ["==", ["get", "category"], "novice_downhill_ski_run"],
        "#00ff00",
        ["==", ["get", "category"], "easy_downhill_ski_run"],
        "#0000ff",
        ["==", ["get", "category"], "intermediate_downhill_ski_run"],
        "#ff0000",
        ["==", ["get", "category"], "advanced_downhill_ski_run"],
        "#000000",
        ["==", ["get", "category"], "expert_downhill_ski_run"],
        "#ffa500",
        ["==", ["get", "category"], "freeride_downhill_ski_run"],
        "#ffff00",
        "#b4b4b4",
      ],
      "line-width": [
        "interpolate",
        ["linear"],
        ["zoom"],
        13,
        0,
        14,
        [
          "case",
          [
            "in",
            ["get", "category"],
            [
              "literal",
              [
                "novice_downhill_ski_run",
                "easy_downhill_ski_run",
                "intermediate_downhill_ski_run",
                "advanced_downhill_ski_run",
                "expert_downhill_ski_run",
                "freeride_downhill_ski_run",
              ],
            ],
          ],
          2,
          1,
        ]
      ],
      "line-opacity": {
        "base": 1,
        "stops": [
          [13, 0],
          [14, 1]
        ]
      } as any,
    }}
  ></LineLayer>
  <SymbolLayer
    id="basemap-area-name-national_park"
    sourceLayer={"park"}
    filter={[
      "all",
      ["in", "category", "protected_area" as any, "national_park" as any, "nature_reserve" as any],
    ] as any}
    layout={{
      "text-font": ["Noto Sans Italic"],
      "text-size": {
        base: 1.2,
        stops: [
          [12, 10],
          [15, 14],
        ],
      } as any,
      "text-field": [
        "coalesce",
        ["get", "name:en"], // Try to get name in the specified language
        ["get", "name"], // Fallback to default name if not available
      ],
      "symbol-spacing": 1250,
      "text-max-width": 9,
      "text-transform": "none",
      "symbol-avoid-edges": false,
      "text-letter-spacing": 0.1,
    }}
    paint={{
      "text-color": "rgba(94, 141, 58, 1)",
      "text-halo-blur": 0.5,
      "text-halo-color": "rgba(255,255,255,0.8)",
      "text-halo-width": 2,
      "text-opacity": {
        "base": 1,
        "stops": [
          [5, 0],
          [6, 1]
        ]
      } as any,
    }}
  ></SymbolLayer>
  <SymbolLayer
    id="basemap-water-name-lakeline"
    sourceLayer={"water"}
    filter={["all", ["==", "$type", "LineString"]]}
    layout={{
      "symbol-placement": "line",
      "symbol-spacing": 350,
      "text-field": [
        "coalesce",
        ["get", "name:en"], // Try to get name in the specified language
        ["get", "name"], // Fallback to default name if not available
      ],
      "text-font": ["Noto Sans Italic"],
      "text-letter-spacing": 0.2,
      "text-max-width": 5,
      "text-rotation-alignment": "map",
      "text-size": 14,
    }}
    paint={{
      "text-color": "#74aee9",
      "text-halo-color": "rgba(255,255,255,0.7)",
      "text-halo-width": 2,
      "text-opacity": {
        "base": 1,
        "stops": [
          [5, 0],
          [6, 1]
        ]
      } as any,
    }}
  ></SymbolLayer>
  <SymbolLayer
    id="basemap-water-name-ocean"
    sourceLayer={"water"}
    filter={["all", ["==", "class", "water"]]}
    layout={{
      "symbol-placement": "point",
      "symbol-spacing": 350,
      "text-field": [
        "coalesce",
        ["get", "name:en"], // Try to get name in the specified language
        ["get", "name"], // Fallback to default name if not available
      ],
      "text-font": ["Noto Sans Italic"],
      "text-letter-spacing": 0.2,
      "text-max-width": 5,
      "text-rotation-alignment": "map",
      "text-size": 14,
    }}
    paint={{
      "text-color": "#74aee9",
      "text-halo-color": "rgba(255,255,255,0.7)",
      "text-halo-width": 2,
    }}
  ></SymbolLayer>
  <SymbolLayer
    id="basemap-water-name-other"
    sourceLayer={"water"}
    filter={["all", ["==", "$type", "Point"]]}
    layout={{
      "symbol-placement": "point",
      "symbol-spacing": 350,
      "text-field": [
        "coalesce",
        ["get", "name:en"], // Try to get name in the specified language
        ["get", "name"], // Fallback to default name if not available
      ],
      "text-font": ["Noto Sans Italic"],
      "text-letter-spacing": 0.2,
      "text-max-width": 5,
      "text-rotation-alignment": "map",
      "text-size": {
        stops: [
          [0, 10],
          [6, 14],
        ],
      } as any,
    }}
    paint={{
      "text-color": "#74aee9",
      "text-halo-color": "rgba(255,255,255,0.7)",
      "text-halo-width": 2,
    }}
  ></SymbolLayer>
</VectorTileSource>
