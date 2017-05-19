var controls = Object.create(null);

function createPaint(parent: HTMLElement) {
  var canvas = elt("canvas", { width: 500, height: 300 }) as HTMLCanvasElement;
  var cx = canvas.getContext("2d");
  var toolbar = elt("div", { class: "toolbar" });
  for (var name in controls)
    toolbar.appendChild(controls[name](cx));

  var panel = elt("div", { class: "picturepanel" }, canvas);
  parent.appendChild(elt("div", null, panel, toolbar));
}

var tools = Object.create(null);

controls.tool = function (cx) {
  var select = elt("select") as HTMLSelectElement;
  for (var name in tools)
    select.appendChild(elt("option", null, name));

  cx.canvas.addEventListener("mousedown", function (event) {
    if (event.which == 1) {
      tools[select.value](event, cx);
      event.preventDefault();
    }
  });

  return elt("span", null, "Tool: ", select);
};

function relativePos(event, element: HTMLElement) {
  var rect = element.getBoundingClientRect();
  return {
    x: Math.floor(event.clientX - rect.left),
    y: Math.floor(event.clientY - rect.top)
  };
}

function trackDrag(onMove, onEnd?) {
  function end(event) {
    removeEventListener("mousemove", onMove);
    removeEventListener("mouseup", end);
    if (onEnd)
      onEnd(event);
  }
  addEventListener("mousemove", onMove);
  addEventListener("mouseup", end);
}

tools.Line = function (event, cx, onEnd) {
  cx.lineCap = "round";

  var pos = relativePos(event, cx.canvas);
  trackDrag(function (event) {
    cx.beginPath();
    cx.moveTo(pos.x, pos.y);
    pos = relativePos(event, cx.canvas);
    cx.lineTo(pos.x, pos.y);
    cx.stroke();
  }, onEnd);
};

tools.Erase = function (event, cx) {
  cx.globalCompositeOperation = "destination-out";
  tools.Line(event, cx, function () {
    cx.globalCompositeOperation = "source-over";
  });
};

interface coord {
  x: number;
  y: number;
}

interface rectangle {
  left: number;
  top: number;
  width: number;
  height: number;
}

function findRect(pos1: coord, pos2: coord): rectangle {
  const left = Math.min(pos1.x, pos2.x);
  const top = Math.min(pos1.y, pos2.y);
  const width = Math.abs(pos2.x - pos1.x);
  const height = Math.abs(pos2.y - pos1.y);
  return { left, top, width, height };
}

tools.Rectangle = function (event, cx: CanvasRenderingContext2D) {
  const pos: coord = relativePos(event, cx.canvas);

  trackDrag((event) => {
    var div = document.getElementById('recDiv');

    if (div) {
      div.parentNode.removeChild(div);
    }
    const mpos: coord = { x: event.pageX, y: event.pageY };
    const r = findRect(pos, mpos);
    div = elt("div", {
      style: `width: ${r.width}px;height: ${r.height}px;border: 1px solid;position: absolute;top: ${r.top}px;left: ${r.left}px`,
      id: "recDiv"
    });
    document.body.appendChild(div);

  },
    (event) => {
      var div = document.getElementById('recDiv');
      div.parentNode.removeChild(div);
      const fpos: coord = relativePos(event, cx.canvas);
      const r = findRect(pos, fpos);
      cx.fillRect(r.left, r.top, r.width, r.height);
    });
}

interface rgba {
  r: number;
  g: number;
  b: number;
  a: number;
};

tools["Pick color"] = function (event, cx: CanvasRenderingContext2D) {
  const pos: coord = relativePos(event, cx.canvas);
  try {
    const colorsArray = cx.getImageData(pos.x, pos.y, 1, 1).data;
    const colors: rgba = { r: colorsArray[0], g: colorsArray[1], b: colorsArray[2], a: colorsArray[3] };
    cx.fillStyle = `rgb(${colors.r}, ${colors.g}, ${colors.b})`;
    cx.strokeStyle = `rgb(${colors.r}, ${colors.g}, ${colors.b})`;
  } catch (e) {
    if (e instanceof SecurityError)
      alert(JSON.stringify("Can't save: " + e.toString()));
    else
      throw e;
  }
};

tools["Flood fill"] = function (event, cx) {
  const pos: coord = relativePos(event, cx.canvas);
  const imgData: number[] = cx.getImageData(0, 0, 500, 300).data;
  const pixels = imgData.length;
  var imgp = [];
  for (var i = 0; i < pixels; i += 4) {
    imgp.push({
      'r': imgData[i],
      'g': imgData[i + 1],
      'b': imgData[i + 2],
      'a': imgData[i + 3],
      'checked': false,
      'connected': false
    });
  }
  imgp[pos.y*500+pos.x].connected = true;
  imgp[pos.y*500+pos.x].checked = true;
};

function flood(img, pos) {
  
}

controls.color = function (cx) {
  var input = elt("input", { type: "color" }) as HTMLInputElement;
  input.addEventListener("change", function () {
    cx.fillStyle = input.value;
    cx.strokeStyle = input.value;
  });
  return elt("span", null, "Color: ", input);
};

controls.brushSize = function (cx) {
  var select = elt("select") as HTMLSelectElement;
  var sizes = [1, 2, 3, 5, 8, 12, 25, 35, 50, 75, 100];
  sizes.forEach(function (size) {
    select.appendChild(elt("option", { value: size },
      size + " pixels"));
  });
  select.addEventListener("change", function () {
    cx.lineWidth = select.value;
  });
  return elt("span", null, "Brush size: ", select);
};

controls.save = function (cx) {
  var link = elt("a", { href: "/" }, "Save") as HTMLAnchorElement;
  function update() {
    try {
      link.href = cx.canvas.toDataURL();
    } catch (e) {
      if (e instanceof SecurityError)
        link.href = "javascript:alert(" +
          JSON.stringify("Can't save: " + e.toString()) + ")";
      else
        throw e;
    }
  }
  link.addEventListener("mouseover", update);
  link.addEventListener("focus", update);
  return link;
};

function loadImageURL(cx, url) {
  var image = document.createElement("img");
  image.addEventListener("load", function () {
    var color = cx.fillStyle, size = cx.lineWidth;
    cx.canvas.width = image.width;
    cx.canvas.height = image.height;
    cx.drawImage(image, 0, 0);
    cx.fillStyle = color;
    cx.strokeStyle = color;
    cx.lineWidth = size;
  });
  image.src = url;
}

controls.openFile = function (cx): HTMLDivElement {
  var input = elt("input", { type: "file" }) as HTMLInputElement;
  input.addEventListener("change", function () {
    if (input.files.length == 0) return;
    var reader = new FileReader();
    reader.addEventListener("load", function () {
      loadImageURL(cx, reader.result);
    });
    reader.readAsDataURL(input.files[0]);
  });
  return elt("div", null, "Open file: ", input) as HTMLDivElement;
};

controls.openURL = function (cx: CanvasRenderingContext2D) {
  var input = elt("input", { type: "text" }) as HTMLInputElement;
  var form = elt("form", null,
    "Open URL: ", input,
    elt("button", { type: "submit" }, "load")) as HTMLFormElement;
  form.addEventListener("submit", function (event) {
    event.preventDefault();
    loadImageURL(cx, input.value);
  });
  return form;
};

tools.Text = function (event, cx) {
  var text = prompt("Text:", "");
  if (text) {
    var pos = relativePos(event, cx.canvas);
    cx.font = Math.max(7, cx.lineWidth) + "px sans-serif";
    cx.fillText(text, pos.x, pos.y);
  }
};

tools.Spray = function (event, cx) {
  var radius = cx.lineWidth / 2;
  var area = radius * radius * Math.PI;
  var dotsPerTick = Math.ceil(area / 30);

  var currentPos = relativePos(event, cx.canvas);
  var spray = setInterval(function () {
    for (var i = 0; i < dotsPerTick; i++) {
      var offset = randomPointInRadius(radius);
      cx.fillRect(currentPos.x + offset.x,
        currentPos.y + offset.y, 1, 1);
    }
  }, 25);
  trackDrag(function (event) {
    currentPos = relativePos(event, cx.canvas);
  }, function () {
    clearInterval(spray);
  });
};

function randomPointInRadius(radius: number) {
  for (; ;) {
    var x = Math.random() * 2 - 1;
    var y = Math.random() * 2 - 1;
    if (x * x + y * y <= 1)
      return { x: x * radius, y: y * radius };
  }
}

function elt(name: string, attributes?: object, ...children) {
  var node = document.createElement(name);
  if (attributes) {
    for (var attr in attributes)
      if (attributes.hasOwnProperty(attr))
        node.setAttribute(attr, attributes[attr]);
  }
  for (var i = 0; i < children.length; i++) {
    var child = children[i];
    if (typeof child == "string")
      child = document.createTextNode(child);
    node.appendChild(child);
  }
  return node;
}