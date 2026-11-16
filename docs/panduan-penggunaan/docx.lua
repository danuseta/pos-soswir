function Image(img)
  img.attributes.height = nil
  img.attributes.keepaspectratio = nil
  img.attributes.cfbox = nil
  if img.attributes.width == "72%" then
    img.attributes.width = "11cm"
  elseif img.src == "img/logo.png" then
    img.attributes.width = "2cm"
  else
    img.attributes.width = "16cm"
  end
  return img
end

function Pandoc(doc)
  local blocks = {}
  local started = false
  for _, block in ipairs(doc.blocks) do
    if block.t == "Header" then
      started = true
    end
    if started then
      table.insert(blocks, block)
    end
  end
  doc.blocks = blocks
  return doc
end
