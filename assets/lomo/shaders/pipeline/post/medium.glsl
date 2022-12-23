#version 400
#extension GL_ARB_conservative_depth: enable

/* lomo:pipeline/copy.frag */

uniform sampler2D u_input;

layout(location = 0) out vec4 out_color;

void main() {
	out_color = texelFetch(u_input, ivec2(gl_FragCoord.xy), 0);
}
                                                                                                                                                                                                                                                                                   ************************************************/

// render seconds
// world days
// world time
// moon size

// emissive rgb + ambient intensity

// w is view distance

// rgb + intensity

// w is player mood

// w is effect strength

// w is darkness scale

// w is sky flash strength

// framebuffer width (pixels)
// framebuffer height (pixels)
// framebuffer width / height
// normalized screen brightness - game setting

// xy = raw block/sky
// zw = smoothed block/sky

// w is EMPTY spare slot for now

// w is sky rotation in radians

// rgb: skylight color modified for atmospheric effects
// a: skylight transition smoothing factor 0-1

// rgb: raw skylight color
// a: skylight illuminance in lux

// 15 - 18 reserved for cascades 0-3

// x = fog start
// y = fog end
// z = held light inner angle
// w = held light outer angle

// x = rain strength
// y = thunder strength
// z = smoothed rain strength
// w = smoothed thunder strength

// UINT ARRAY

// update each frame
uniform vec4[32] _cvu_world;
uniform uint[1] _cvu_world_uint;
uniform uint[4] _cvu_flags;

// updated each invocation as needed
uniform vec4[2] _cvu_model_origin;
uniform int _cvu_model_origin_type;
uniform mat3 _cvu_normal_model_matrix;
uniform vec2 _cvu_fog_info;

// base index of cascades 0-3

// base index of cascades 0-3

uniform mat4[25] _cvu_matrix;

uniform mat4 _cvu_g