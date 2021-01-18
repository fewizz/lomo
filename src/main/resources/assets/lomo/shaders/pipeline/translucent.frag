#include frex:shaders/api/header.glsl
#include lomo:shaders/lib/transform.glsl

/* lomo:pipeline/translucent.frag */

uniform sampler2D u_translucent;
uniform sampler2D u_translucent_depth;
uniform sampler2D u_solid;
uniform sampler2D u_solid_depth;

varying vec2 _cvv_texcoord;

vec3 blend(vec4 dst, vec4 src) {
    return (dst.rgb * (1.0 - src.a)) + src.rgb;
}

void main() {
    vec4 color = vec4(0);
    vec4 translucent_color = texture2D(u_translucent, _cvv_texcoord);
    vec4 solid_color = texture2D(u_solid, _cvv_texcoord);

    if(translucent_color == vec4(0)) {
        color = solid_color;
    }
    else {
        vec2 win_xy = gl_FragCoord.xy;

        mat4 pm = frx_projectionMatrix();

        float translucent_depth = vec4(texture2D(u_translucent_depth, _cvv_texcoord)).r;
        vec3 translucent_v = window_to_world(vec3(win_xy, translucent_depth), pm);
        float solid_depth = vec4(texture2D(u_solid_depth, _cvv_texcoord)).r;
        vec3 solid_v = window_to_world(vec3(win_xy, solid_depth), pm);

        color = translucent_color;
		solid_v /= 10;
		translucent_v /= 10;

        color.a = clamp(dot(solid_v, solid_v) - dot(translucent_v, translucent_v), 0, 1);
        color = vec4(blend(solid_color, color), 1);
    }

    gl_FragData[0] = color;
}