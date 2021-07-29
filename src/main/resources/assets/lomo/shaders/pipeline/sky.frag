#include lomo:shaders/lib/sky.glsl

uniform sampler2D u_solid_d;

layout(location = 0) out vec4 out_color;

void main() {
	if(texelFetch(u_solid_d, ivec2(gl_FragCoord.xy), 0).r != 1.0) {
		discard;
		return;
	}

	vec3 cam = win_to_cam(gl_FragCoord.xyz);
	vec3 dir = normalize(mat3(frx_inverseViewMatrix()) * cam);

	out_color = vec4(sky_color(dir), 1.0);
}
