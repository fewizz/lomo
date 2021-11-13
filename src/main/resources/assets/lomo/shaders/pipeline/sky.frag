#include lomo:shaders/lib/sky.glsl

uniform sampler2D u_solid_d;

out vec4 out_color;

void main() {
	if(texelFetch(u_solid_d, ivec2(gl_FragCoord.xy), 0).r != 1.0) {
		discard;
		return;
	}

	vec3 dir = normalize(
		mat3(frx_inverseViewMatrix)
		*
		(
			win_to_cam(vec3(gl_FragCoord.xy, 1))
			-
			win_to_cam(vec3(gl_FragCoord.xy, 0))
		)
	);

	out_color = vec4(sky_color(dir, 0.0), 1.0);
}
