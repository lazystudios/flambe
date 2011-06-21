import flambe.Entity;
import flambe.display.ImageSprite;
import flambe.display.Transform;
import flambe.System;

class Main
{
    private static function main ()
    {
        System.init();

        _loader = System.loadAssetPack("bootstrap");
        // Add listeners
        _loader.success.connect(onSuccess);
        _loader.error.connect(function (message) {
            trace("Load error: " + message);
        });
        _loader.progress.connect(function () {
            trace("Loading progress... " + _loader.bytesLoaded + " of " + _loader.bytesTotal);
        });
        // Go!
        _loader.start();
    }

    private static function onSuccess ()
    {
        trace("Loading complete!");

        for (ii in 0...10) {
            var tentacle = new Entity()
                .add(new ImageSprite(_loader.pack.createTexture("tentacle.png")))
                .add(new Draggable());
            var sprite = tentacle.get(ImageSprite);
            var xform = tentacle.get(Transform);
            xform.x.set(Math.random() * (System.stageWidth-sprite.getNaturalWidth()));
            xform.y.set(Math.random() * (System.stageHeight-sprite.getNaturalHeight()));
            System.root.addChild(tentacle);
        }
    }

    private static var _loader;
}