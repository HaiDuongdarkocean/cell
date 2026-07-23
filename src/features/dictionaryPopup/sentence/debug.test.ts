import { describe, beforeEach, it, expect } from '@jest/globals';
import { extractSentenceContext } from './sentenceModule';

describe('extractSentenceContext — 50 Ocean paragraph cases', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  const cases: { sentence: string; term: string; offset: number }[] = [
    {
      sentence: "The ocean is the body of salt water that covers approximately 70.8% of Earth.",
      term: "The",
      offset: 0,
    },
    {
      sentence: "The ocean is conventionally divided into large bodies of water, which are also referred to as oceans (in descending order by area: the Pacific Ocean, the Atlantic Ocean, the Indian Ocean, the Antarctic/Southern Ocean, and the Arctic Ocean), and are themselves mostly divided into seas, gulfs and subsequent bodies of water.",
      term: "The",
      offset: 0,
    },
    {
      sentence: "The ocean contains 97% of Earth's water and is the primary component of Earth's hydrosphere, acting as a huge reservoir of heat for Earth's energy budget, as well as for its carbon cycle and water cycle, forming the basis for climate and weather patterns worldwide.",
      term: "The",
      offset: 0,
    },
    {
      sentence: "The ocean is essential to life on Earth, harbouring most of Earth's animals and protist life.",
      term: "The",
      offset: 0,
    },
    {
      sentence: "It originated photosynthesis and therefore Earth's atmospheric oxygen, and still supplies half of it.",
      term: "It",
      offset: 0,
    },
    {
      sentence: "Ocean scientists split the ocean into vertical and horizontal zones based on physical and biological conditions.",
      term: "Ocean",
      offset: 0,
    },
    {
      sentence: "Horizontally the ocean covers the oceanic crust, which it shapes.",
      term: "Horizontally",
      offset: 0,
    },
    {
      sentence: "Where the ocean meets dry land it covers relatively shallow continental shelves, which are part of Earth's continental crust.",
      term: "Where",
      offset: 0,
    },
    {
      sentence: "Human activity is mostly coastal with high negative impacts on marine life.",
      term: "Human",
      offset: 0,
    },
    {
      sentence: "Vertically the pelagic zone is the open ocean's water column from the surface to the ocean floor.",
      term: "Vertically",
      offset: 0,
    },
    {
      sentence: "The water column is further divided into zones based on depth and the amount of light present.",
      term: "The",
      offset: 0,
    },
    {
      sentence: "The photic zone starts at the surface and is defined to be \"the depth at which light intensity is only 1% of the surface value\": 36 (approximately 200 m in the open ocean).",
      term: "The",
      offset: 0,
    },
    {
      sentence: "This is the zone where photosynthesis can occur.",
      term: "This",
      offset: 0,
    },
    {
      sentence: "In this process plants and microscopic algae (free-floating phytoplankton) use light, water, carbon dioxide, and nutrients to produce organic matter.",
      term: "In",
      offset: 0,
    },
    {
      sentence: "As a result, the photic zone is the most biodiverse and the source of the food supply which sustains most of the ocean ecosystem.",
      term: "As",
      offset: 0,
    },
    {
      sentence: "Light can only penetrate a few hundred more meters; the rest of the deeper ocean is cold and dark (these zones are called mesopelagic and aphotic zones).",
      term: "Light",
      offset: 0,
    },
    {
      sentence: "Ocean temperatures depend on the amount of solar radiation reaching the ocean surface.",
      term: "Ocean",
      offset: 0,
    },
    {
      sentence: "In the tropics, surface temperatures can rise to over 30 °C (86 °F).",
      term: "In",
      offset: 0,
    },
    {
      sentence: "Near the poles where sea ice forms, the temperature in equilibrium is about −2 °C (28 °F).",
      term: "Near",
      offset: 0,
    },
    {
      sentence: "In all parts of the ocean, deep ocean temperatures range between −2 °C (28 °F) and 5 °C (41 °F).",
      term: "In",
      offset: 0,
    },
    {
      sentence: "Constant circulation of water in the ocean creates ocean currents.",
      term: "Constant",
      offset: 0,
    },
    {
      sentence: "Those currents are caused by forces operating on the water, such as temperature and salinity differences, atmospheric circulation (wind), and the Coriolis effect.",
      term: "Those",
      offset: 0,
    },
    {
      sentence: "Tides create tidal currents, while wind and waves cause surface currents.",
      term: "Tides",
      offset: 0,
    },
    {
      sentence: "The Gulf Stream, Kuroshio Current, Agulhas Current and Antarctic Circumpolar Current are all major ocean currents.",
      term: "The",
      offset: 0,
    },
    {
      sentence: "Such currents transport massive amounts of water, gases, pollutants and heat to different parts of the world, and from the surface into the deep ocean.",
      term: "Such",
      offset: 0,
    },
    {
      sentence: "All this has impacts on the global climate system.",
      term: "All",
      offset: 0,
    },
    {
      sentence: "Ocean water contains dissolved gases, including oxygen, carbon dioxide and nitrogen.",
      term: "Ocean",
      offset: 0,
    },
    {
      sentence: "An exchange of these gases occurs at the ocean's surface.",
      term: "An",
      offset: 0,
    },
    {
      sentence: "The solubility of these gases depends on the temperature and salinity of the water.",
      term: "The",
      offset: 0,
    },
    {
      sentence: "The carbon dioxide concentration in the atmosphere is rising due to CO2 emissions, mainly from fossil fuel combustion.",
      term: "The",
      offset: 0,
    },
    {
      sentence: "As the oceans absorb CO2 from the atmosphere, a higher concentration leads to ocean acidification (a drop in pH value).",
      term: "As",
      offset: 0,
    },
    {
      sentence: "The ocean provides many benefits to humans such as ecosystem services, access to seafood and other marine resources, and a means of transport.",
      term: "The",
      offset: 0,
    },
    {
      sentence: "The ocean is known to be the habitat of over 230,000 species, but may hold considerably more – perhaps over two million species.",
      term: "The",
      offset: 0,
    },
    {
      sentence: "Yet, the ocean faces many environmental threats, such as marine pollution, overfishing, and the effects of climate change.",
      term: "Yet",
      offset: 0,
    },
    {
      sentence: "Those effects include ocean warming, ocean acidification and sea level rise.",
      term: "Those",
      offset: 0,
    },
    {
      sentence: "The continental shelf and coastal waters are most affected by human activity.",
      term: "The",
      offset: 0,
    },
    {
      sentence: "The ocean is the body of salt water that covers approximately 70.8% of Earth.",
      term: "ocean",
      offset: 4,
    },
    {
      sentence: "The ocean is conventionally divided into large bodies of water, which are also referred to as oceans (in descending order by area: the Pacific Ocean, the Atlantic Ocean, the Indian Ocean, the Antarctic/Southern Ocean, and the Arctic Ocean), and are themselves mostly divided into seas, gulfs and subsequent bodies of water.",
      term: "ocean",
      offset: 4,
    },
    {
      sentence: "The ocean contains 97% of Earth's water and is the primary component of Earth's hydrosphere, acting as a huge reservoir of heat for Earth's energy budget, as well as for its carbon cycle and water cycle, forming the basis for climate and weather patterns worldwide.",
      term: "ocean",
      offset: 4,
    },
    {
      sentence: "The ocean is essential to life on Earth, harbouring most of Earth's animals and protist life.",
      term: "ocean",
      offset: 4,
    },
    {
      sentence: "It originated photosynthesis and therefore Earth's atmospheric oxygen, and still supplies half of it.",
      term: "originated",
      offset: 3,
    },
    {
      sentence: "Ocean scientists split the ocean into vertical and horizontal zones based on physical and biological conditions.",
      term: "scientists",
      offset: 6,
    },
    {
      sentence: "Horizontally the ocean covers the oceanic crust, which it shapes.",
      term: "the",
      offset: 13,
    },
    {
      sentence: "Where the ocean meets dry land it covers relatively shallow continental shelves, which are part of Earth's continental crust.",
      term: "the",
      offset: 6,
    },
    {
      sentence: "Human activity is mostly coastal with high negative impacts on marine life.",
      term: "activity",
      offset: 6,
    },
    {
      sentence: "Vertically the pelagic zone is the open ocean's water column from the surface to the ocean floor.",
      term: "the",
      offset: 11,
    },
    {
      sentence: "The water column is further divided into zones based on depth and the amount of light present.",
      term: "water",
      offset: 4,
    },
    {
      sentence: "The photic zone starts at the surface and is defined to be \"the depth at which light intensity is only 1% of the surface value\": 36 (approximately 200 m in the open ocean).",
      term: "photic",
      offset: 4,
    },
    {
      sentence: "This is the zone where photosynthesis can occur.",
      term: "is",
      offset: 5,
    },
    {
      sentence: "In this process plants and microscopic algae (free-floating phytoplankton) use light, water, carbon dioxide, and nutrients to produce organic matter.",
      term: "this",
      offset: 3,
    },
  ];

  it.each(cases)('extracts term %s from sentence starting with %p', ({ sentence, term, offset }) => {
    const p = document.createElement('p');
    p.textContent = sentence;
    document.body.appendChild(p);
    const textNode = p.firstChild as Text;
    const ctx = extractSentenceContext(textNode, offset);
    expect(ctx).not.toBeNull();
    expect(ctx!.sentence).toBe(sentence);
    expect(ctx!.term).toBe(term);
    expect(ctx!.cursorOffset).toBe(offset);
  });
});