function HerculesRMX () {}
HerculesRMX.leds = { 
"scratch":0x29, 
// "[Channel1] cue blink":0x3C,
// "[Channel2] cue blink":0x54,
"[Channel1] cue":0x0C,
"[Channel2] cue":0x24
// "[Channel1] play":0x0B,
// "[Channel2] play":0x23
 };
HerculesRMX.debug = false; 
HerculesRMX.ledOn = 0x7F;
HerculesRMX.ledOff = 0x00;
HerculesRMX.scratchMode = false;
HerculesRMX.playlistJogScrollMode = false;
HerculesRMX.decayLast = new Date().getTime();
HerculesRMX.decayInterval = 300;
HerculesRMX.decayRate = 0.5;
HerculesRMX.cueButton = { "[Channel1]": false, "[Channel2]": false};
HerculesRMX.cuePlay = { "[Channel1]": false, "[Channel2]": false};
// TODO HerculesRMX controls should be divided into channels...  then signals should directed 
// to each channel without thinking about specific controls to allow for easy rebinding.

HerculesRMX.init = function (id) {    // called when the MIDI device is opened & set up
    // TODO clear all lights
    print ("HerculesRMX id: \""+id+"\" initialized.");

    for ( var LED in HerculesRMX.leds ) {
        print("Clear LED: " + LED);
        midi.sendShortMsg(0xB0, HerculesRMX.leds[LED], HerculesRMX.ledOff);  // Scratch button
    }

    engine.connectControl("[Channel1]","playposition","HerculesRMX.wheelDecay");
    engine.connectControl("[Channel2]","playposition","HerculesRMX.wheelDecay");
}

HerculesRMX.wheelDecay = function (value) {    
    if (engine.getValue("[Channel1]","play") + engine.getValue("[Channel2]","play") == 0) { return; }
    currentDate = new Date().getTime();
    // print(currentDate);
    if (currentDate > HerculesRMX.decayLast + HerculesRMX.decayInterval) {
       HerculesRMX.decayLast = currentDate;

       if (HerculesRMX.debug) print(" new playposition: " + value + " decayLast: "+ HerculesRMX.decayLast);
       if (HerculesRMX.scratchMode) { // do some scratching
          if (HerculesRMX.debug) print("Scratch deck1: " + engine.getValue("[Channel1]","scratch") + " deck2: "+ engine.getValue("[Channel2]","scratch"));
          // print("do scratching " + jogValue);
          // engine.setValue(channel,"scratch", jogValue); // /64);
          jog1 = engine.getValue("[Channel1]","scratch"); 
	  if (jog1 != 0) {
	     if (Math.abs(jog1) > HerculesRMX.decayRate) {  
                engine.setValue("[Channel1]","scratch", (jog1 * HerculesRMX.decayRate).toFixed(2));
             } else {
                engine.setValue("[Channel1]","scratch", 0);
             }
          }
       } else { // do pitch adjustment
          if (HerculesRMX.debug) print("Wheel deck1: " + engine.getValue("[Channel1]","wheel") + " deck2: "+ engine.getValue("[Channel2]","wheel"));
          jog1 = engine.getValue("[Channel1]","wheel"); 
	  if (jog1 != 0) {
	     if (Math.abs(jog1) > HerculesRMX.decayRate) {  
                engine.setValue("[Channel1]","wheel", (jog1 * HerculesRMX.decayRate).toFixed(2));
             } else {
                engine.setValue("[Channel1]","wheel", 0);
             }
          }
       }
    }
}

HerculesRMX.shutdown = function(id) {
}

HerculesRMX.getChannel = function (control){ 
// get the "group" that used to be provided in channel, this is not reusable across devices
// and also breaks remapping of these functions to other buttons.  
   controlToChannel = { 
                0x2F:"[Channel1]", 
                0x30:"[Channel2]", 
		0x0C:"[Channel1]", // Cue
     		0x24:"[Channel2]",
		0x0B:"[Channel1]", // Play
		0x23:"[Channel2]",
		0x0D:"[Channel1]", // Stop
		0x25:"[Channel2]",
		0x12:"[Channel1]", // Load Deck
		0x16:"[Channel2]",
		0x2F:"[Channel1]", // Jog Wheels 
		0x30:"[Channel2]" 
   }
   return controlToChannel[control];
}


HerculesRMX.toggle_scratch_mode = function (channel, control, value, status) {
    if (value > 0) {
	HerculesRMX.scratchMode = !HerculesRMX.scratchMode;
        midi.sendShortMsg(0xB0, HerculesRMX.leds["scratch"] , (HerculesRMX.scratchMode ? HerculesRMX.ledOn : HerculesRMX.ledOff));  // Scratch button
    }
}

HerculesRMX.stop_and_reset_track = function (channel, control, value, status) {
   channel = HerculesRMX.getChannel(control);
   if (engine.getValue(channel, "duration") == 0) { if (value) print("No song on " + channel); return; };
   if (value > 0) {
        engine.setValue(channel,"cue_default",0);
	engine.setValue(channel,"play",0);
	engine.setValue(channel,"start",0);

        HerculesRMX.cueButton[channel] = false;
        HerculesRMX.cuePlay[channel] = false;
        midi.sendShortMsg(0xB0, HerculesRMX.leds[channel + " cue"], HerculesRMX.ledOff);
   }
}

HerculesRMX.up_down_arrows = function (channel, control, value, status) {
   // TODO replace with two seperate functions (Next/Prev) to make them distinctly rebindable.
   script.debug(channel, control, value, status);
   HerculesRMX.playlistJogScrollMode = value > 0;
   if (value > 0) {
     switch (control) {
        case 0x2A: engine.setValue("[Playlist]","SelectPrevTrack", (value > 0)); break;
        case 0x2B: engine.setValue("[Playlist]","SelectNextTrack", (value > 0)); break;
     }
   }
}
                        
HerculesRMX.jog_wheel = function (channel, control, value, status) {
//  7F > 40: CCW Slow > Fast - 127 > 64 
//  01 > 3F: CW Slow > Fast - 0 > 63
   channel = HerculesRMX.getChannel(control);
//   print ("Wheel");
//   script.debug(channel, control, value, status);

   jogValue = value >=0x40 ? value - 0x80 : value; // -64 to +63, - = CCW, + = CW
   if (HerculesRMX.playlistJogScrollMode) { // zip through library quickly
        engine.setValue("[Playlist]","SelectTrackKnob", jogValue);
   } else if (HerculesRMX.scratchMode) { // do some scratching
       if (HerculesRMX.debug) print("do scratching value:" + value + " jogValue: " + jogValue );
       // engine.setValue(channel,"scratch", engine.getValue(channel,"scratch") + (jogValue/64));
       engine.setValue(channel,"scratch", (engine.getValue(channel,"scratch") + (jogValue/64)).toFixed(2));
   } else { // do pitch adjustment
       // if (HerculesRMX.debug) print("do pitching adjust " + jogValue);
       engine.setValue(channel,"wheel", (engine.getValue(channel,"wheel") + (jogValue/5)).toFixed(2));
   }
}

HerculesRMX.cue = function (channel, control, value, status) {
   channel = HerculesRMX.getChannel(control);
   if (engine.getValue(channel, "duration") == 0) { if (value) print("No song on " + channel); return; };

   if (value) { // Down
      HerculesRMX.cueButton[channel] = true;
      HerculesRMX.cuePlay[channel] = false;
      engine.setValue(channel,"cue_default",1);
      midi.sendShortMsg(0xB0, HerculesRMX.leds[channel + " cue"], HerculesRMX.ledOn);
   } else { // Release
     if (HerculesRMX.debug) print("R. Play: " + engine.getValue(channel,"play") + " PlayPosition: " + engine.getValue(channel,"playposition") + " cue_default: "+ engine.getValue(channel,"cue_default"));

     if (HerculesRMX.cuePlay[channel]) {
//       engine.setValue(channel,"cue_default",0);
        engine.setValue(channel,"play",1);
     }
     midi.sendShortMsg(0xB0, HerculesRMX.leds[channel + " cue"], HerculesRMX.ledOff);
     HerculesRMX.cuePlay[channel] = false;
     HerculesRMX.cueButton[channel] = false;
   }
}

HerculesRMX.play = function (channel, control, value, status) {
   // Only send events when play is pushed, not when it comes back up.
   channel = HerculesRMX.getChannel(control);
   if (engine.getValue(channel, "duration") == 0) { if (value) print("No song on " + channel); return; };

   if (value) {
      if (HerculesRMX.cueButton[channel] && engine.getValue(channel,"play")) {
        HerculesRMX.cuePlay[channel] = true;
        midi.sendShortMsg(0xB0, HerculesRMX.leds[channel + " cue"], HerculesRMX.ledOff);     
        playposition = engine.getValue(channel,"playposition");
        engine.setValue(channel,"play",0);
        if (HerculesRMX.debug) print("1. Play: " + engine.getValue(channel,"play") + " PlayPosition: " + engine.getValue(channel,"playposition") + " cue_default: "+ engine.getValue(channel,"cue_default"));
        engine.setValue(channel,"cue_default",0);
        if (HerculesRMX.debug) print("2. Play: " + engine.getValue(channel,"play") + " PlayPosition: " + engine.getValue(channel,"playposition") + " cue_default: "+ engine.getValue(channel,"cue_default"));
        engine.setValue(channel,"playposition", playposition);
        if (HerculesRMX.debug) print("3. Play: " + engine.getValue(channel,"play") + " PlayPosition: " + engine.getValue(channel,"playposition") + " cue_default: "+ engine.getValue(channel,"cue_default"));
        engine.setValue(channel,"play",1);
        if (HerculesRMX.debug) print("4. Play: " + engine.getValue(channel,"play") + " PlayPosition: " + engine.getValue(channel,"playposition") + " cue_default: "+ engine.getValue(channel,"cue_default"));
	return;
      } else {
        engine.setValue(channel,"play", !engine.getValue(channel,"play"));
      }
   }
}

