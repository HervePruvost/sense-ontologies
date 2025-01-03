// Copyright 2021 Observable, Inc.
// Released under the ISC license.
// https://observablehq.com/@d3/disjoint-force-directed-graph
function ForceGraph(
  {
    nodes, // an iterable of node objects (typically [{id}, …])
    links, // an iterable of link objects (typically [{source, target}, …])
  },
  {
    nodeId = (d) => d.id, // given d in nodes, returns a unique identifier (string)
    nodeGroup, // given d in nodes, returns an (ordinal) value for color
    nodeGroups, // an array of ordinal values representing the node groups
    nodeTitle, // given d in nodes, a title string
    nodeFill = "currentColor", // node stroke fill (if not using a group color encoding)
    nodeStroke = "#fff", // node stroke color
    nodeStrokeWidth = 1.5, // node stroke width, in pixels
    nodeStrokeOpacity = 1, // node stroke opacity
    nodeRadius = 65, // node radius, in pixels
    nodeStrength = -2000,
    linkSource = ({ source }) => source, // given d in links, returns a node identifier string
    linkTarget = ({ target }) => target, // given d in links, returns a node identifier string
    linkStroke = "#999", // link stroke color
    linkStrokeOpacity = 0.6, // link stroke opacity
    linkStrokeWidth = 4, // given d in links, returns a stroke width in pixels
    linkStrokeLinecap = "round", // link stroke linecap
    linkStrength = 2,
    linkDistance = 300,
    colors = d3.schemeTableau10, // an array of color strings, for the node groups
    width = 640, // outer width, in pixels
    height = 400, // outer height, in pixels
    invalidation, // when this promise resolves, stop the simulation
    nodeURL = "https://doi.org/10.1061/(ASCE)CP.1943-5487.0001065", // NEW: given d in nodes, returns the URL (string)
  } = {}
) {
  // Compute values.
  const N = d3.map(nodes, nodeId).map(intern);
  const LS = d3.map(links, linkSource).map(intern);
  const LT = d3.map(links, linkTarget).map(intern);
  if (nodeTitle === undefined) nodeTitle = (_, i) => N[i];
  const T = nodeTitle == null ? null : d3.map(nodes, nodeTitle);
  const G = nodeGroup == null ? null : d3.map(nodes, nodeGroup).map(intern);
  const W =
    typeof linkStrokeWidth !== "function"
      ? null
      : d3.map(links, linkStrokeWidth);
  const L = typeof linkStroke !== "function" ? null : d3.map(links, linkStroke);
  const U = nodeURL == null ? null : d3.map(nodes, nodeURL).map(intern);

  // Replace the input nodes and links with mutable objects for the simulation.
  nodes = d3.map(nodes, (_, i) => ({ id: N[i] }));
  links = d3.map(links, (_, i) => ({ source: LS[i], target: LT[i] }));

  // Compute default domains.
  if (G && nodeGroups === undefined) nodeGroups = d3.sort(G);

  // Construct the scales.
  const color = nodeGroup == null ? null : d3.scaleOrdinal(nodeGroups, colors);

  // Construct the forces.
  const forceNode = d3.forceManyBody();
  const forceLink = d3
    .forceLink(links)
    .id(({ index: i }) => N[i])
    .distance(linkDistance);
  if (nodeStrength !== undefined) forceNode.strength(nodeStrength);
  if (linkStrength !== undefined) forceLink.strength(linkStrength);

  const simulation = d3
    .forceSimulation(nodes)
    .force("link", forceLink)
    .force("charge", forceNode)
    .force("x", d3.forceX())
    .force("y", d3.forceY())
    .on("tick", ticked);

  const svg = d3
    .create("svg")
    .attr("width", width)
    .attr("height", height)
    .attr("viewBox", [-width / 2, -height / 2, width, height])
    .attr("style", "max-width: 100%; height: auto; height: intrinsic;");

  var defs = svg.append("defs");

  defs
    .append("radialGradient")
    .attr("id", "internal-gradient")
    .selectAll("stop")
    .data([
      {
        offset: "20%",
        color: "#98fb98",
      },
      {
        offset: "100%",
        color: "#32cd32",
      },
    ])
    .enter()
    .append("stop")
    .attr("offset", function (d) {
      return d.offset;
    })
    .attr("stop-color", function (d) {
      return d.color;
    });

  defs
    .append("radialGradient")
    .attr("id", "external-gradient")
    .attr("cx", "50%")
    .attr("cy", "50%")
    .attr("r", "50%")
    .selectAll("stop")
    .data([
      {
        offset: "50%",
        color: "#00bfff",
      },
      {
        offset: "100%",
        color: "#1e90ff",
      },
    ])
    .enter()
    .append("stop")
    .attr("offset", function (d) {
      return d.offset;
    })
    .attr("stop-color", function (d) {
      return d.color;
    });

  const link = svg
    .append("g")
    .attr("stroke", linkStroke)
    .attr("stroke-opacity", linkStrokeOpacity)
    .attr(
      "stroke-width",
      typeof linkStrokeWidth !== "function" ? linkStrokeWidth : null
    )
    .attr("stroke-linecap", linkStrokeLinecap)
    .selectAll("line")
    .data(links)
    .join("line");

  if (W) link.attr("stroke-width", ({ index: i }) => W[i]);

  const node = svg
    .append("g")
    .attr("fill", nodeFill)
    .attr("stroke", nodeStroke)
    .attr("stroke-opacity", nodeStrokeOpacity)
    .attr("stroke-width", nodeStrokeWidth)
    // SM: change
    // .selectAll("circle")
    .selectAll("g")
    .data(nodes)
    // SM: change
    // .join("circle")
    .join("g")
    // SM: change
    // .attr("r", nodeRadius)
    .call(drag(simulation));

  node.append("circle").attr("r", nodeRadius);

  // Put labels inside nodes
  node
    .append("text")
    .text(({ index: i }) => T[i])
    .attr("fill", "black")
    .attr("stroke", "none")
    .attr("font-family", "serif")
    .attr("font-size", "1.5em")
    .attr("font-weight", "540")
    .style("text-anchor", "middle")
    .attr("y", "0.3em");

  if (W) link.attr("stroke-width", ({ index: i }) => W[i]);
  if (L) link.attr("stroke", ({ index: i }) => L[i]);
  if (G) node.attr("fill", ({ index: i }) => color(G[i]));
  if (T) node.append("title").text(({ index: i }) => T[i]);

  // My custom color with gradient
  node.style("fill", function ({ index: i }) {
    //console.log(G[i]);
    return G[i] == "internal"
      ? "url(#internal-gradient)"
      : "url(#external-gradient)";
  });

  //click behavior on nodes
  node.on("click", function (d, { index: i }) {
    console.log(U[i]);
    baseURL = window.location.href + "/../";
    const url = new URL(U[i], baseURL);
    // const url = new URL("https://doi.org/10.1061/(ASCE)CP.1943-5487.0001065");
    console.log("open tab");
    window.open(
      //"https://doi.org/10.1061/(ASCE)CP.1943-5487.0001065",
      url,
      "_blank" // <- This is what makes it open in a new window.
    );
  });

  // Handle invalidation.
  if (invalidation != null) invalidation.then(() => simulation.stop());

  function intern(value) {
    return value !== null && typeof value === "object"
      ? value.valueOf()
      : value;
  }

  function ticked() {
    link
      .attr("x1", (d) => d.source.x)
      .attr("y1", (d) => d.source.y)
      .attr("x2", (d) => d.target.x)
      .attr("y2", (d) => d.target.y);

    node.attr("transform", (d) => `translate(${d.x} ${d.y})`);
    // SM: change
    // instead of moving the circle centers we transform the whole <g>
    // .attr("cx", d => d.x)
    // .attr("cy", d => d.y);
  }

  function drag(simulation) {
    function dragstarted(event) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
    }

    function dragged(event) {
      event.subject.fx = event.x;
      event.subject.fy = event.y;
    }

    function dragended(event) {
      if (!event.active) simulation.alphaTarget(0);
      event.subject.fx = null;
      event.subject.fy = null;
    }

    return d3
      .drag()
      .on("start", dragstarted)
      .on("drag", dragged)
      .on("end", dragended);
  }

  return Object.assign(svg.node(), { scales: { color } });
}

// var graphUrl = "./linkedDataModel.json"; //filepath or url for your data goes here
// const graph = fetch("./linkedDataModel.json")
//   .then((response) => {
//     return response.json();
//   })
//   .then((data) => console.log(data));
const graph = {
  nodes: [
    {
      id: "sense",
      name: "SENSE",
      group: "internal",
      url: "./sense/doc/index.html",
    },
    {
      id: "esim",
      name: "ESIM",
      group: "internal",
      url: "./esim/doc/index.html",
    },
    {
      id: "risk",
      name: "RISK",
      group: "internal",
      url: "./risk/doc/index.html",
    },
    {
      id: "metric",
      name: "METRIC",
      group: "internal",
      url: "./metric/doc/index.html",
    },
    {
      id: "baf",
      name: "BAF",
      group: "internal",
      url: "./baf/doc/index.html",
    },
    {
      id: "brick",
      name: "Brick",
      group: "external",
      url: "https://brickschema.org/ontology",
    },
    {
      id: "bot",
      name: "BOT",
      group: "external",
      url: "https://w3id.org/bot",
    },
    {
      id: "ifcowl",
      name: "ifcOWL",
      group: "external",
      url: "https://standards.buildingsmart.org/IFC/DEV/IFC4/ADD2_TC1/OWL/index.html",
    },
    {
      id: "ssn",
      name: "SSN",
      group: "external",
      url: "https://www.w3.org/TR/vocab-ssn/",
    },
    {
      id: "sosa",
      name: "SOSA",
      group: "external",
      url: "https://www.w3.org/2015/spatial/wiki/SOSA_Ontology",
    },
    {
      id: "qudt",
      name: "QUDT",
      group: "external",
      url: "https://www.qudt.org/",
    },
    {
      id: "saref",
      name: "SAREF",
      group: "external",
      url: "https://saref.etsi.org/core/",
    },
    // {
    //   id: "ngsi-ld",
    //   name: "NGSI-LD",
    //   group: "external",
    //   url: "https://forge.etsi.org/rep/NGSI-LD/NGSI-LD",
    // },
    {
      id: "cim",
      name: "CIM",
      group: "external",
      url: "https://webstore.iec.ch/publication/74467",
    },
    {
      id: "sargon",
      name: "SARGON",
      group: "external",
      url: "https://sargon-n5geh.netlify.app/Ontology",
    },
    {
      id: "realestatecore",
      name: "REC",
      group: "external",
      url: "https://dev.realestatecore.io/ontology/",
    },
  ],
  links: [
    {
      source: "esim",
      target: "sense",
    },
    {
      source: "risk",
      target: "sense",
    },
    {
      source: "baf",
      target: "sense",
    },
    {
      source: "metric",
      target: "sense",
    },
    {
      source: "sosa",
      target: "ssn",
    },
    {
      source: "ssn",
      target: "sense",
    },
    {
      source: "brick",
      target: "sense",
    },
    {
      source: "bot",
      target: "esim",
    },
    {
      source: "bot",
      target: "brick",
    },
    {
      source: "ifcowl",
      target: "esim",
    },
    // {
    //   source: "ifcowl",
    //   target: "bot",
    // },
    {
      source: "qudt",
      target: "brick",
    },
    {
      source: "realestatecore",
      target: "brick",
    },
    {
      source: "saref",
      target: "sargon",
    },
  ],
};

var chart = ForceGraph(graph, {
  nodeId: (d) => d.id,
  nodeGroup: (d) => d.group,
  nodeTitle: (d) => d.name,
  nodeURL: (d) => d.url,
  width: 1200,
  height: 1150,
  //nodeRadius: 80
  //  invalidation // a promise to stop the simulation when the cell is re-run
});

d3.select("#networkGraph")
  .append(() => chart)
  .attr("preserveAspectRatio", "xMinYMin meet");
