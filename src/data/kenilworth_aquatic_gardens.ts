interface KenilworthPolygonPointsCollection {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    geometry: {
      coordinates: number[][][];
      type: "Polygon";
    };
    properties: {
      name?: string;
    };
    id: string;
  }>;
}

export const kenilworthPolygonCoordinates: KenilworthPolygonPointsCollection = {
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": {
        "coordinates": [
          [
            [
              -76.945324,
              38.912633
            ],
            [
              -76.949841,
              38.912616
            ],
            [
              -76.949476,
              38.91022
            ],
            [
              -76.944755,
              38.912132
            ],
            [
              -76.942674,
              38.91204
            ],
            [
              -76.94173,
              38.912374
            ],
            [
              -76.941386,
              38.913593
            ],
            [
              -76.944938,
              38.913935
            ],
            [
              -76.945324,
              38.912633
            ]
          ]
        ],
        "type": "Polygon"
      },
      "properties": {
        "name": "Polygon for Area"
      },
      "id": "E5MzY"
    }
  ]
};