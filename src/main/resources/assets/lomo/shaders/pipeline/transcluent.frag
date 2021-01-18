#include frex:shaders/api/header.glsl
#include frex:shaders/api/view.glsl
#include canvas:shaders/pipeline/pipeline.glsl

uniform sampler2D transcluent;
uniform sampler2D transcluentDepth;
uniform sampler2D solid;
uniform sampler2D solidDepth;

varying vec2 _cvv_texcoord;

float xw_to_xd(float xw) {
    return (xw / frx_viewWidth()) * 2 - 1;
}

float yw_to_yd(float yw) {
    return (yw / frx_viewHeight()) * 2 - 1;
}

float zw_to_zd(float zw) {
    float n = gl_DepthRange.near;
    float f = gl_DepthRange.far;

    return (zw - (n + f)/2) / ((f - n)/2);
}

float zw_to_z(float zw) {
    float zd = zw_to_zd(zw);

    mat4 m = frx_projectionMatrix();

    return -m[3][2] / (m[2][2] + zd);
}

vec3 from_window_to_world(vec3 w) {
    vec2 ndc = vec2(xw_to_xd(w.x), yw_to_yd(w.y));

    mat4 m = frx_projectionMatrix();

    float z = zw_to_z(w.z);
    float x = (-z * (ndc.x + m[2][0])) / m[0][0];
    float y = (-z * (ndc.y + m[2][1])) / m[1][1];

    return vec3(x, y, z);
}

vec3 blend(vec4 dst, vec4 src) {
    return (dst.rgb * (1.0 - src.a)) + src.rgb;
}

void main() {
    vec4 color = vec4(0, 0, 0, 1);
    vec4 transcluentColor = texture2D(transcluent, _cvv_texcoord);
    vec4 solidColor = texture2D(solid, _cvv_texcoord);

    vec2 win_xy = gl_FragCoord.xy;

    float transcluentZ = vec4(texture2D(transcluentDepth, _cvv_texcoord)).r;
    float transcluentD = length(from_window_to_world(vec3(win_xy, transcluentZ)));
    float solidZ = vec4(texture2D(solidDepth, _cvv_texcoord)).r;
    float solidD = length(from_window_to_world(vec3(win_xy, solidZ)));

    if(transcluentColor == vec4(0)) {
        color = solidColor;
    }
    else {
        color = transcluentColor;
		solidD /= 10;
		transcluentD /= 10;

        color.a = clamp(pow(solidD, 2) - pow(transcluentD, 2), 0, 1);
        color = vec4(blend(solidColor, color), 1);
        //color = vec4(vec3(transcluentD/20), 1);
    }

    gl_FragData[0] = color;
}