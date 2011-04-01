package flambe.platform.amity;

import flambe.asset.AssetPackLoader;
import flambe.display.MouseEvent;
import flambe.display.Texture;
import flambe.Entity;
import flambe.FrameVisitor;
import flambe.platform.AppDriver;

class AmityAppDriver
    implements AppDriver
{
    public function new ()
    {
    }

    public function init (root :Entity)
    {
#if debug
        // Redirect traces to Amity
        haxe.Log.trace = (untyped __amity).log;
#end
        var frameVisitor = new FrameVisitor(new AmityDrawingContext());
        (untyped __amity.events).onEnterFrame = function (dt :Int) {
            frameVisitor.init(dt);
            root.visit(frameVisitor);
        };
        (untyped __amity.events).onMouseDown = function (event) {
            var fevent = new MouseEvent();
            fevent.viewX = event.x;
            fevent.viewY = event.y;
            System.mouseDown.emit(fevent);
        }
    }

    public function loadAssetPack (url :String) :AssetPackLoader
    {
        return new AmityAssetPackLoader(url);
    }
}
